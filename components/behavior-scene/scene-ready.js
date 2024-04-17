module.exports = Behavior({
  behaviors: [],
  properties: {
  },
  data: {
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    renderWidth: 0,
    renderHeight: 0,
    windowHeight: 1000,
    heightScale: 0.75,
    dpiScale: 1,
    showBackBtn: false,
    activeValues: [1],
    arTrackerShow: false,
    arTrackerState: 'Init',
    arTrackerError: ''
  },
  attached: function(){},
  ready() {
    /**
     * 函数就绪后加载小程序设备信息
     */
    const info = wx.getSystemInfoSync();
    const width = info.windowWidth;
    const windowHeight = info.windowHeight;
    const height = windowHeight * this.data.heightScale;
    const dpi = info.pixelRatio;
    console.log('info', info)
    this.setData({
      width,
      height,
      renderWidth: width * dpi * this.data.dpiScale,
      renderHeight: height * dpi * this.data.dpiScale,
      windowHeight
    });
  },
  methods: {
    /**
     * 加载后上报信息，统计使用
     * @param {*} options 
     */
    onLoad(options) {
      wx.reportEvent("xr_frame", {
        "xr_page_path": options.path
      });
    },
    /**
     * 分享按钮功能 用户点击右上角转发
     * @returns title-分享页面的标题 imageUrl-分享展示的图片url
     */
    onShareAppMessage() {
      try {
        if (wx.xrScene) {
          // 保存当前界面生成图片
          const buffer = wx.xrScene.share.captureToArrayBuffer({quality: 0.5});
          const fp = `${wx.env.USER_DATA_PATH}/ar-learning-tools-share.jpg`;
          wx.getFileSystemManager().writeFileSync(fp, buffer, 'binary');
          return {
            title: this.getTitle(),
            imageUrl: fp
          };
        }
      } catch (e) {
        return {
          title: this.getTitle()
        };
      }
    },
    /**
     * 用户点击右上角转发到朋友圈 触发
     * @returns 
     */
    onShareTimeline() {
      try {
        // 如果是xr框架页面
        if (wx.xrScene) {
          const buffer = wx.xrScene.share.captureToArrayBuffer({quality: 0.5});
          const fp = `${wx.env.USER_DATA_PATH}/ar-learning-tools-share.jpg`;
          wx.getFileSystemManager().writeFileSync(fp, buffer, 'binary');
          return {
            title: this.getTitle(),
            imageUrl: fp
          };
        }
      } catch (e) {
        return {
          title: this.getTitle()
        }
      }
    },
    // 生成分享标题
    getTitle() {
      return wx.xrTitle ? `XR - ${wx.xrTitle}` : 'AR 学习助手';
    },
    // xr 识别状态处理函数
    handleARTrackerState({detail}) {
      const {state, error} = detail;
      this.setData({
        arTrackerShow: true,
        arTrackerState: wx.getXrFrameSystem().EARTrackerState[state],
        arTrackerError: error
      });
    }
  }
})