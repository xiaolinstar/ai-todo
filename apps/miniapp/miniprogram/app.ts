import { ensureAuth } from "./lib/auth";
import { getDefaultApiUrl, isDevelopEnv } from "./lib/config";
import { enableShareMenu } from "./lib/share";

type PrivacyAuthorizationResolve = (result: {
  event: "agree" | "disagree";
  buttonId?: string;
}) => void;

function setupPrivacyAuthorization() {
  if (!wx.onNeedPrivacyAuthorization) {
    return;
  }

  wx.onNeedPrivacyAuthorization((resolve: PrivacyAuthorizationResolve) => {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage && typeof currentPage.showPrivacyAuthorization === "function") {
      currentPage.showPrivacyAuthorization(resolve);
      return;
    }

    wx.showModal({
      title: "用户隐私保护提示",
      content: "继续使用前，请先阅读并同意本小程序的隐私保护指引。",
      confirmText: "同意",
      cancelText: "拒绝",
      success(result) {
        resolve({
          event: result.confirm ? "agree" : "disagree",
          buttonId: result.confirm ? "privacy-modal-agree" : "privacy-modal-disagree"
        });
      },
      fail() {
        resolve({ event: "disagree", buttonId: "privacy-modal-fail" });
      }
    });
  });
}

App({
  globalData: {},
  onLaunch() {
    setupPrivacyAuthorization();
    const apiUrl = wx.getStorageSync("apiUrl");
    if (!isDevelopEnv()) {
      wx.setStorageSync("apiUrl", getDefaultApiUrl());
    } else if (typeof apiUrl !== "string" || !apiUrl) {
      wx.setStorageSync("apiUrl", getDefaultApiUrl());
    }
    ensureAuth().catch(() => undefined);
    if (!isDevelopEnv()) {
      enableShareMenu();
    }
  }
});
