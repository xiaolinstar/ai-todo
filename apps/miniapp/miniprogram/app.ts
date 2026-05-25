import { ensureAuth } from "./lib/auth";
import { getDefaultApiUrl } from "./lib/config";

App({
  globalData: {},
  onLaunch() {
    const apiUrl = wx.getStorageSync("apiUrl");
    if (typeof apiUrl !== "string" || !apiUrl) {
      wx.setStorageSync("apiUrl", getDefaultApiUrl());
    }
    ensureAuth().catch(() => undefined);
  }
});
