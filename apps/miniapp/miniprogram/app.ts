import { ensureAuth } from "./lib/auth";
import { getDefaultApiUrl } from "./lib/config";

App({
  globalData: {},
  onLaunch() {
    const apiUrl = wx.getStorageSync<string>("apiUrl");
    if (!apiUrl) {
      wx.setStorageSync("apiUrl", getDefaultApiUrl());
    }
    ensureAuth().catch(() => undefined);
  }
});
