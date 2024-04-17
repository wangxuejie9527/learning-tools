// 导入函数
var sceneReadyBehavior = require('../../components/behavior-scene/scene-ready');

Page({
  // 声明函数别名
  behaviors:[sceneReadyBehavior],
  moveTimes: 0,
  // 定义内部变量
  data: {
    // 内置
    height: 600,
    heightScale: 0.85,
    showBackBtn: true,
    // 页面
    useScan: true,
    useGLTF: false,
    useVideo1: false,
    useVideo2: false,
    markerList: [],
    markerDesc:'AR 学习助手，快去扫描课本图片试试吧！',
    markerTitle:'',
    // scan 相关
    showMarkerWrap: false,
    markerLeft: -50,
    markerTop: 50,
    markerWidth: 0,
    markerHeight: 0,
    // 全局状态
    dataReady: false,
    // Debug
    debugMsg: 'Defalut Words'
  },
  onLoad( ) {
    // 初始化云服务
    // this.initCloud();
    // 初始化数据
    this.refreshData();
  },
  initCloud() {
    wx.cloud.init({
      env: 'ar-4gs53kcqc5890b4c',
      traceUser: true,
    })
  },
  resetData() {
    this.setData({
      dataReady: false,
      showMarkerWrap: false,
      markerLeft: -50,
      markerTop: 50,
      markerWidth: 0,
      markerHeight: 0,
    })
  },
  refreshData() {
    // 重置页面数据
    this.resetData();

    // 需要使用的marker
    let markerList = []

    let scanIndex = 0
    let videoIndex = 0
    let gltfIndex = 0
    let that = this

    // 读取数据，初始化需要的识别信息
    const db = wx.cloud.database();
    const _ = db.command
    db.collection('ar-tracker').where({
      type : _.neq('daily'),
    }).get({
      success: function (res) {
        const data = res.data
        console.log(data)
        // const data = res.data
        for (let i = 0; i < data.length; i++) {
          const mockItem = data[i];
          // console.log(mockItem)
          switch (mockItem.type) {
            case 'scan': // scan
              const scanId = 'scan' + scanIndex
              markerList.push({
                id: scanId,
                name: mockItem.name,
                renderType: mockItem.type,
                markerImage: mockItem.markerImg,
                src: mockItem.src,
                desc:mockItem.desc
              });
              scanIndex++;
              break;
            case 'video': // video
              const videoId = 'video' + videoIndex
              markerList.push({
                id: videoId,
                name: mockItem.name,
                renderType: mockItem.type,
                markerImage: mockItem.markerImg,
                src: mockItem.src,
                desc:mockItem.desc
              });
              videoIndex++;
              break;
            case 'gltf': // gltf
              const gltfId = 'gltf' + gltfIndex
              markerList.push({
                id: gltfId,
                name: mockItem.name,
                renderType: mockItem.type,
                markerImage: mockItem.markerImg,
                src: mockItem.src,
                desc:mockItem.desc
              });
              gltfIndex++;
              break;
          }
        }
        that.setData({
          dataReady: true,
          markerList: markerList
        });
      }
    })
  },
  handleTrackerChange(cur) {
    // ar 识别后回调函数
    // 设置扫描需要展示的信息
    const item = cur.detail;
    var markDesc = item.desc;
    markDesc = markDesc.replace(/\\n/g, '\n');
    markDesc = markDesc.replace(/\\'/g,'\'');
    this.setData({
      debugMsg: 'handleTrackerChange:' + item.name,
      markerDesc: markDesc,
      markerTitle: item.name
    })
    console.log('cur', cur)
  },
  handleTrackerMove(cur) {
    // 处理镜头移动
    const detail = cur.detail
    const trackerInfo = detail.trackerInfo
    
    this.moveTimes++

    if (detail.type === 'scan') {
      if (detail.active) {
        this.setData({
          showMarkerWrap: true,
          markerLeft: Math.floor((trackerInfo.x) * 100),
          markerTop: Math.floor((trackerInfo.y) * 100) * this.data.heightScale,
          markerWidth: Math.floor(trackerInfo.halfWidth * 2 * this.data.width),
          markerHeight: Math.floor(trackerInfo.halfWidth * 2 * this.data.width / trackerInfo.widthDivideHeight),
          // debugMsg: 'pos:' + trackerInfo.x + '\n' + trackerInfo.y + '\n halfWidth:' + trackerInfo.halfWidth + '\nmoveTimes:' + this.moveTimes
        })
      } else {
        this.setData({
          showMarkerWrap: false,
        })
      }
    }
  },
});
