import { ensureAuth } from "./lib/auth";
import { getDefaultApiUrl, isDevelopEnv } from "./lib/config";

App({
  globalData: {},
  onLaunch() {
    const apiUrl = wx.getStorageSync("apiUrl");
    if (!isDevelopEnv()) {
      wx.setStorageSync("apiUrl", getDefaultApiUrl());
    } else if (typeof apiUrl !== "string" || !apiUrl) {
      wx.setStorageSync("apiUrl", getDefaultApiUrl());
    }
    ensureAuth().catch(() => undefined);
  }
});
