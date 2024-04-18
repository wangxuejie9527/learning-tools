/**
 * 每日一句页面
 */
// 导入函数
var sceneReadyBehavior = require('../../components/behavior-scene/scene-ready');
var util = require('../../utils/util');
var plugin = requirePlugin("chatbot");

/**
 * tabs 初始定义
 * 开始于
 * skip
 * 结束于
 */
const ScrollState = {
  scrollStart: 0,
  scrollUpdate: 1,
  scrollEnd: 2,
};

const db = wx.cloud.database();

// 初始化音频播放器
const audioCtx = wx.createInnerAudioContext({})
// 获取手机屏幕宽度
const {
  windowWidth,
  screenHeight,
  statusBarHeight,
  safeArea,
  windowHeight,
} = wx.getSystemInfoSync()

function clamp(val, min, max) {
  'worklet'
  return Math.min(Math.max(val, min), max)
}

const {
  shared,
  timing
} = wx.worklet

// 留言区滚动动作枚举
const GestureState = {
  POSSIBLE: 0, // 0 此时手势未识别，如 panDown等
  BEGIN: 1, // 1 手势已识别
  ACTIVE: 2, // 2 连续手势活跃状态
  END: 3, // 3 手势终止
  CANCELLED: 4, // 4 手势取消，
}

const date = util.formatTimeYYMMDD(new Date)

Page({
  behaviors: [sceneReadyBehavior, 'wx://form-field-button'],
  data: {
    // 起始被选中tab
    selectedTab: 0,
    // tab 初始定义
    tabs: [{
        title: '每日一句',
        title2: '打招呼常用语句',
        img: '/assets/image/1.jpg',
        desc: 'dddddd ',
      },
      {
        title: '释义',
        title2: '',
        img: '/assets/image/1.jpg',
        desc: 'ffff',
      }
    ],
    // tab 切换动画 对x轴平移
    translateX: 0,
    translateY: 1000,
    isEnglishCategory: true,
    scale: 16,
    list: [],
    tabHigh: 1000,
    commentInput: '',
    height: 88,
    showCommnet: wx.getStorageSync('showCommnet'),
  },
  /**
   * 页面加载中需要处理内容
   */
  onLoad() {
    // 创建共享变量 SharedValue，用于跨线程共享数据和驱动动画。
    // const shared = wx.worklet.shared
    // 音频播放器静音
    audioCtx.obeyMuteSwitch = false
    // 计算每个tab大小 和 tab切换动画
    const innerWindowWidth = windowWidth - 48 // 左右 padding 各 24
    this._tabWidth = shared(innerWindowWidth / 2)
    this._translateX = shared(0)
    this._lastTranslateX = shared(0)
    this._scaleX = shared(0.7)
    this._windowWidth = shared(windowWidth)

    this.transY = shared(0)
    this.scrollTop = shared(0)
    this.startPan = shared(true)
    this.initTransY = shared(0) // 留言半屏的初始位置
    this.upward = shared(false)
    this.tabHeight = shared(1000)
    this.tabTop = shared(0)
    this.tabTottom = shared(1000);

    this.isSensitive = false;

    this.setData({
      height: screenHeight - statusBarHeight,
    })

    // 系统tab高度
    var tabsHight = screenHeight - windowHeight;

    const tabQuery = this.createSelectorQuery()
    tabQuery.select('.scroll-list').boundingClientRect()
    tabQuery.exec((res) => {
      console.log('tab res', res)
      this.tabHeight.value = res[0].height;
      this.tabTop.value = res[0].top;
      this.tabTottom.value = res[0].bottom;
      this.setData({
        height: res[0].height
      })
    })

    if (this.data.showCommnet) {
      const query = this.createSelectorQuery()
      // ready 生命周期里才能获取到首屏的布局信息
      query.select('.upper').boundingClientRect()
      query.exec((res) => {
        this.transY.value = this.initTransY.value = screenHeight - res[0].height - (screenHeight - safeArea.bottom) - tabsHight
      })
      console.log('transY', this.transY.value)
      console.log('initTransY', this.initTransY.value)
      // 通过 transY 一个 SharedValue 控制半屏的位置
      this.applyAnimatedStyle('.comment-container', () => {
        'worklet'
        return {
          transform: `translateY(${this.transY.value}px)`
        }
      })
    }

    this.refreshData()
  },
  // 留言区在load后加载 show时开始加载 提升速度
  onShow() {
    this.refreshComment(date);
  },
  onUnload() {
    // 初始化动画类型为worklet
    this.applyAnimatedStyle('.tab-border', () => {
      'worklet'
      return {
        transform: `translateX(${this._translateX.value}px) scaleX(${this._scaleX.value})`,
      }
    })

    this.applyAnimatedStyle('.comment-container', () => {
      'worklet'
      return {
        transform: `translateY(${this.transY.value}px)`,
      }
    })

  },
  // 切换tab时 重置留言区位置
  onHide() {
    // 收回 留言
    this.transY.value = this.initTransY.value;
  },
  // tab 点击触发事件
  onTapTab(evt) {
    const {
      tab
    } = evt.currentTarget.dataset || {}
    this.setData({
      selectedTab: tab,
    })
  },
  // tab 切换事件
  onTabChanged(evt) {
    const index = evt.detail.current
    this.setData({
      selectedTab: index,
    })
    // 设置动画平移多少
    if (this.renderer !== 'skyline') {
      this.setData({
        translateX: this._tabWidth.value * index
      })
    }
  },
  // swiper 切换过程中每帧回调，声明为 worklet 函数使其跑在 UI 线程
  onTabTransition(evt) {
    'worklet'
    // 这里 swiper item 是占满了整个屏幕宽度，算出拖动比例，换算成相对 tab width 的偏移
    const translateRatio = evt.detail.dx / this._windowWidth.value
    this._translateX.value = this._lastTranslateX.value + translateRatio * this._tabWidth.value

    // 控制 scale 值，拖到中间时 scale 处于最大值 1，两端递减
    const scaleRatio = (this._translateX.value / this._tabWidth.value) % 1
    const changedScale = scaleRatio <= 0.5 ? scaleRatio : (1 - scaleRatio) // 最大值 0.5
    this._scaleX.value = Math.abs(changedScale) * 0.6 + 0.7

    if (evt.detail.state === ScrollState.scrollEnd) {
      this._lastTranslateX.value = this._translateX.value
    }
  },
  onTabTransitionEnd(evt) {
    'worklet'
    this.onTabTransition(evt)

    // end
    this._lastTranslateX.value = this._translateX.value
  },
  // 刷新数据
  refreshData() {
    const date = util.formatTimeYYMMDD(new Date)
    console.log('date', date);
    this.refreshComment();
    this.refreshTabs();
  },
  // 刷新留言
  refreshComment(date) {
    let that = this
    db.collection('daily-comment').where({
      date: date,
      category: 'English'
    }).orderBy('createTime', 'desc').get({
      success: function (res) {
        console.log('daily', res)
        that.setData({
          list: res.data
        })
      }
    })
  },
  // 刷新tab
  refreshTabs(date) {
    let that = this
    db.collection('ar-tracker').where({
      type: 'daily',
      date: date,
      category: 'English'
    }).limit(1).get({
      success: function (res) {
        console.log(res)
        if (res.length < 1) {
          return;
        }
        var dbRes = res.data[0]
        var newTabs = [{
            title: dbRes.tab1Title,
            title2: dbRes.tab1Title2,
            img: dbRes.coverImg,
            desc: dbRes.text.replace(/\\n/g, '\n').replace(/\\'/g, '\''),
          },
          {
            title: dbRes.tab2Title,
            title2: dbRes.tab2Title2,
            img: dbRes.explainImg,
            desc: dbRes.explain.replace(/\\n/g, '\n').replace(/\\'/g, '\''),
          }
        ];
        audioCtx.src = dbRes.tts
        that.setData({
          tabs: newTabs
        })
      }
    })
  },
  // 弃用
  bindNavTab() {
    this.setData({
      isEnglishCategory: !this.data.isEnglishCategory
    })
    this.refreshData();
  },
  // 播放翻译语音
  audioPlay: function () {
    console.log('audioPlay')
    audioCtx.play()
  },
  setHeight(height) {
    this.setData({
      height: height
    })
  },
  // 留言区滚动动画处理
  scrollTo(toValue) {
    'worklet'

    this.transY.value = timing(toValue, {
      duration: 200
    })
  },
  // shouldPanResponse 和 shouldScrollViewResponse 用于 pan 手势和 scroll-view 滚动手势的协商
  shouldPanResponse() {
    'worklet'
    return this.startPan.value
  },
  shouldScrollViewResponse(pointerEvent) {
    'worklet'
    // transY > 0 说明 pan 手势在移动半屏，此时滚动不应生效
    if (this.transY.value > statusBarHeight) return false

    const scrollTop = this.scrollTop.value
    const {
      deltaY
    } = pointerEvent
    // deltaY > 0 是往上滚动，scrollTop <= 0 是滚动到顶部边界，此时 pan 开始生效，滚动不生效
    const result = scrollTop <= 0 && deltaY > 0
    this.startPan.value = result
    return !result
  },
  // 处理拖动半屏的手势
  handlePan(gestureEvent) {
    'worklet'
    // 滚动半屏的位置
    if (gestureEvent.state === GestureState.ACTIVE) {
      // deltaY < 0，往上滑动
      this.upward.value = gestureEvent.deltaY < 0
      // 当前半屏位置
      const curPosition = this.transY.value
      // 只能在 [statusBarHeight, screenHeight] 之间移动
      const destination = clamp(curPosition + gestureEvent.deltaY, statusBarHeight, screenHeight)
      if (curPosition === destination) return
      // 改变 transY，来改变半屏的位置
      this.transY.value = destination
    }
    var half = this.tabTop.value + this.tabHeight.value / 2

    if (gestureEvent.state === GestureState.END || gestureEvent.state === GestureState.CANCELLED) {
      if (this.transY.value <= half) {
        // 在上面的位置
        if (this.upward.value) {
          this.scrollTo(this.tabTop.value)
          // wx.worklet.runOnJS(this.setHeight.bind(this))(this.tabHeight.value)
        } else {
          this.scrollTo(half)
          // wx.worklet.runOnJS(this.setHeight.bind(this))(this.tabHeight.value / 2)
        }
      } else if (this.transY.value > half && this.transY.value <= this.initTransY.value) {
        // 在中间位置的时候
        if (this.upward.value) {
          this.scrollTo(half)
          // wx.worklet.runOnJS(this.setHeight.bind(this))(this.tabHeight.value / 2)
        } else {
          this.scrollTo(this.initTransY.value)
          // wx.worklet.runOnJS(this.setHeight.bind(this))(this.tabHeight.value)
        }
      } else {
        // 在最下面的位置
        this.scrollTo(this.initTransY.value)
        // wx.worklet.runOnJS(this.setHeight.bind(this))(this.tabHeight.value)
      }
    }
  },
  adjustDecelerationVelocity(velocity) {
    'worklet'
    const scrollTop = this.scrollTop.value
    return scrollTop <= 0 ? 0 : velocity
  },
  handleScroll(evt) {
    'worklet'
    this.scrollTop.value = evt.detail.scrollTop
  },
  // 简单兼容 WebView
  handleTouchEnd() {
    if (this.renderer === 'skyline') {
      return
    }
    var half = this.tabTop.value + this.tabHeight.value / 2

    if (this.transY.value === this.tabTop.value) {
      this.lastTransY = this.tabTop.value
      this.scrollTo(half)
      this.setData({
        height: this.tabHeight.value / 2,
      })
    } else if (this.transY.value === half && this.lastTransY === this.tabTop.value) {
      this.lastTransY = half
      this.scrollTo(this.initTransY.value)
      this.setData({
        height: this.tabHeight.value / 2,
      })
    } else if (this.transY.value === this.initTransY.value) {
      this.lastTransY = this.initTransY.value
      this.scrollTo(half)
      this.setData({
        height: this.tabHeight.value / 2,
      })
    } else if (this.transY.value === half && this.lastTransY === this.initTransY.value) {
      this.scrollTo(this.tabTop.value)
      this.setData({
        height: this.tabHeight.value / 2,
      })
    }
  },
  // 处理提交留言
  async submitComment(e) {
    console.log(e.detail.value['comment'])

    var comment = e.detail.value['comment'].toString().trim();
    if (comment.length == 0) {
      return;
    }
    // 校验敏感词
    await this.check(comment);
    if (this.isSensitive) {
      this.isSensitive = false;
      this.setData({
        commentInput: ''
      })
      return;
    }

    db.collection('daily-comment').add({
        // data 字段表示需新增的 JSON 数据
        data: {
          category: 'English',
          comment: comment,
          createTime: db.serverDate(),
          date: util.formatTimeYYMMDD(new Date),
          subCommentList: [],
          userHeadImg: "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0",
          userName: "匿名用户",
        }
      })
      .then(res => {
        console.log('ref', res)
        this.refreshComment();
      });

    this.isSensitive = false;
    this.setData({
      commentInput: ''
    })
  },
   // 校验敏感词函数
  async check(inputWord) {
    let sensitive = false;
    // 调用nlp接口
    await plugin.api.nlp('sensitive', {
      q: inputWord,
      mode: 'cnn'
    }).then(res => {
      sensitive = this.checkIsSensitive(res);
      if (sensitive) {
        console.log('输入的内容' + inputWord + '敏感');
        this.isSensitive = true;
      }
    });
  },
  // 根据nlp接口判断是否包含敏感词
  checkIsSensitive(res) {
    let isSensitive = false;
    for (let i = 0; i < res.result.length; i++) {
      if (res.result[i][0] === 'other' && res.result[i][1] < 0.9) {
        isSensitive = true;
        break;
      }
    }
    return isSensitive;
  }
})