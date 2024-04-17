// app.ts
var plugin = requirePlugin("chatbot");

App({
  globalData: {},
  onLaunch() {
    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 初始化云服务
    wx.cloud.init({
      env: 'ar-4gs53kcqc5890b4c',
      traceUser: true,
    })

    wx.cloud.callFunction({
      name: 'openid',
      complete: res => {
        console.log('callFunction test result: ', res)
        wx.setStorageSync('openid', res.result.openid)
      }
    })

    const openid = wx.getStorageInfo('openid');
    plugin.init({
      appid: "8cEf2UF77Tul8EeKfNBIvLVt92ab4I",
      openid: openid,
      userHeader: "", // 用户头像,不传会弹出登录框
      userName: "", // 用户昵称,不传会弹出登录框
      anonymous: false, // 是否允许匿名用户登录，版本1.2.9后生效, 默认为false，设为true时，未传递userName、userHeader两个字段时将弹出登录框
      success: () => {
        console.log('init chatbot success')
      }, //非必填
      fail: (error) => {
        console.log('init chatbot error', error)
      }, //非必填
    });
    
    // 登录
    wx.login({
      success: res => {
        console.log(res.code)
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      },
    })
  },
})