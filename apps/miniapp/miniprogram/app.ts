App({
  globalData: {},
  onLaunch() {
    const apiUrl = wx.getStorageSync<string>("apiUrl");
    if (!apiUrl) {
      wx.setStorageSync("apiUrl", "http://127.0.0.1:3100");
    }
  }
});
