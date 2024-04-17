// ar组件
Component({
  innerInterval: 0,
  videoId: -1,
  // 组件定义变量
  properties: {
    markerListRaw: {
      type: Array,
      value: []
    },
  },
  // 组件内部参数
  data: {
    loaded: true,
    arReady: false,
    gltfLoaded: false,
    videoLoaded: false,
    videoRatioLoaded: false,
    markerWidth: 1,
    markerHeight: 1,
  },
  // 组件观察变量变化回调
  observers: {
    markerListRaw(newVal) {
      this.setData({
        markerList: newVal,
      })
    },
  },
  // 生命周期函数
  lifetimes: {
    detached() {
      // 关闭时候去除计时器
      clearInterval(this.innerInterval);
    }
  },
  methods: {
    handleReady({detail}) {
      /**
       * xrScene 初始化完成后触发事件函数
       * 初始化需要识别的img
       * 预加载 gltf模型
       */

      const xrScene = this.scene = detail.value;
      console.log('xr-scene', xrScene);


      // 加载场景资源
      const gltfResList = [];
      const videoResList = [];
      // 识别内容分类
      const markerList = this.data.markerList;
      for(let i = 0; i < markerList.length; i++) {
        const marker = markerList[i];
        switch (marker.renderType) {
          case 'gltf':
            gltfResList.push(marker);
            break;
          case 'video':
            videoResList.push(marker);
            break;
        }
      }
      // 预加载 gltf模型
      try {
        this.loadGLTF(gltfResList)
      } catch (err) {
        console.log('[gltf load] error: ', err)
      }
    },
    handleARReady: function() {
      // ar 初始化完成回调
      console.log('arReady')
      this.setData({ arReady: true })
    },
    async loadGLTF(gltfList) {
      /**
       * 加载 gltf 模型
       */
      const scene = this.scene
      const gltfModel = await Promise.all(gltfList.map(gltfItem => scene.assets.loadAsset({
        type: 'gltf',
        assetId: 'gltf-' + gltfItem.id,
        src: gltfItem.src,
      })))
      console.log('glTF asset loaded')
      this.setData({ gltfLoaded: true })
    },
    async loadVideoSingle(videoItem) {
      /**
       * 加载视频
       * 初始化视频纹理
       * 视频材质绑定材质
       */
      const scene = this.scene
      const videoTexture = await scene.assets.loadAsset({
        type: 'video-texture',
        assetId: `video-` + videoItem.id,
        src: videoItem.src,
        options: { loop: true, autoPlay: true },
      });
      // console.log('videoTexture', videoTexture);
      const videoMat = scene.createMaterial(
        scene.assets.getAsset('effect', 'simple'),
        { u_baseColorMap: videoTexture.value.texture }
      )
      scene.assets.addAsset('material', `video-mat-${videoItem.id}`, videoMat)

      console.log('video asset loaded')
      this.setData({
        videoLoaded: true,
      })
    },
    releaseVideo(id) {
      /**
       * 释放视频资源
       */
      if (id !== -1) {
        // 存在纹理才进行释放
        const scene = this.scene
        // 释放加载过的资源
        scene.assets.releaseAsset('video-texture', `video-${id}`);
        scene.assets.releaseAsset('material', `video-mat-${id}`);
      }
    },
    handleTrackerSwitch({ detail }) {
      /**
       * ar 识别结果回调
       * 根据识别结果决定怎么展示
       * 1. 视频结果-释放上次视频资源，加载视频资源，对应标签可见
       * 2. 扫描识别框-处理识别框大小，对应标签可见
       * 3. gltf模型-选择gltf模型，并显示
       */
      console.log('tracked match')
      if (this.data.loaded) {
        const element = detail.el;
        const active = detail.value;
        const data = this.data;
        const markerList = data.markerList;
        for (let i = 0; i < markerList.length; i++) {
          const markerInfo = markerList[i];
          const markerTracker = this.scene.getElementById(`marker-${markerInfo.id}`)
          if (element === markerTracker) {
            // 处理视频纹理
            this.releaseVideo(this.videoId);
            this.videoId = -1;
            // 匹配 tracker
            switch (markerInfo.renderType) {
              case 'scan': // scan
                this.scanHandler(markerTracker, markerInfo, active);
                break;
              case 'video': // video
                if (active) {
                  this.videoHanler(markerInfo);
                }
                break;
              case 'gltf': // gltf
                break;
            }
            // 触发通知事件
            this.triggerEvent('trackerchange', {
              name: markerInfo.name,
              active: active,
              type: markerInfo.renderType,
              desc: markerInfo.desc
            })
          }
        }
      }
    },
    scanHandler(markerTracker, markerInfo, active) {
      const renderType = markerInfo.renderType
      const xrFrameSystem = wx.getXrFrameSystem()
      const camera = this.scene.getElementById('camera').getComponent(xrFrameSystem.Camera);
      const trackerTRS = markerTracker.getComponent(xrFrameSystem.Transform)
      const rightTRS = this.scene.getElementById(`normal-right-${markerInfo.id}`).getComponent(xrFrameSystem.Transform);
      const trackerPos = camera.convertWorldPositionToClip(trackerTRS.worldPosition)
      const rightPos = camera.convertWorldPositionToClip(rightTRS.worldPosition)
      const posX = ((trackerPos.x + 1) / 2)
      const posY = (1 - (trackerPos.y + 1) / 2)
      const rightPosX = ((rightPos.x + 1) / 2)

      // 获取识别图，图片比例
      let widthDivideHeight = 1
      wx.getImageInfo({
        src: markerInfo.markerImage,
        success: res => {
          const {
            width,
            height
          } = res
          widthDivideHeight = width / height
        },
        fail: res => {
          console.error(res)
        }
      })
      // 通知上层
      this.triggerEvent('trackerchange', {
        name: markerInfo.name,
        active: active,
        type: renderType,
        trackerInfo: {
          x: posX,
          y: posY,
          halfWidth: rightPosX - posX,
          widthDivideHeight
        }
      })
      if (active) {
        // 激活态开启tracker位置同步
        let preX = posX;
        let preY = posY;
        let preR = rightPosX
        this.innerInterval = setInterval(()=>{
          const tPos = camera.convertWorldPositionToClip(trackerTRS.worldPosition)
          const rPos = camera.convertWorldPositionToClip(rightTRS.worldPosition)
          const pX = ((tPos.x + 1) / 2)
          const pY = (1 - (tPos.y + 1) / 2)
          const rX = ((rPos.x + 1) / 2)

          const dX = Math.abs(pX - preX)
          const dY = Math.abs(pY - preY)
          const dR = Math.abs(rX - preR)

          if (dX > 0.005 || dY > 0.005 || dR > 0.005) {
            preX = pX;
            preY = pY;
            preR = rX
            this.triggerEvent('trackermove', {
              active: true,
              type: 'scan',
              trackerInfo: {
                x: pX,
                y: pY,
                halfWidth: rX - pX,
                widthDivideHeight
              }
            })
          }
        }, 40)
      } else {
        // 取消态去除tracker位置同步
        clearInterval(this.innerInterval)
        this.triggerEvent('trackermove', {
          active: false,
          type: 'scan',
          trackerInfo: {
            x: 0,
            y: 0,
            halfWidth: 0
          }
        })
      }

    },
    videoHanler(markerInfo) {
      /**
       * 视频素材处理
       * 处理视频展示大小比例
       * 加载视频
       */
      this.setData({
        videoLoaded: false,
        videoRatioLoaded: false,
      })

      // 获取识别图，图片比例
      wx.getImageInfo({
        src: markerInfo.markerImage,
        success: res => {
          const {
            width,
            height
          } = res
          const widthDivideHeight = width / height;

          this.setData({
            markerWidth: 1,
            markerHeight: (1 / widthDivideHeight).toFixed(2),
            videoRatioLoaded: true,
          });

        },
        fail: res => {
          console.error(res)
        }
      })

      try {
        this.loadVideoSingle(markerInfo)
      } catch (err) {
        console.log('[video load] error: ', err)
      }

      this.videoId = markerInfo.id;
    }
  }
})