import { fetchMe, issuePat } from "../../lib/api";
import { clearToken, getConfig, saveConfig } from "../../lib/config";

Page({
  data: {
    apiUrl: "",
    token: "",
    userName: "",
    userId: "",
    timezone: "",
    testing: false,
    issuing: false
  },

  onShow() {
    const config = getConfig();
    this.setData({
      apiUrl: config.apiUrl,
      token: config.token
    });
    if (config.apiUrl) {
      this.onTest();
    }
  },

  onApiUrlInput(e: { detail: { value: string } }) {
    this.setData({ apiUrl: e.detail.value });
  },

  onTokenInput(e: { detail: { value: string } }) {
    this.setData({ token: e.detail.value });
  },

  onSave() {
    saveConfig({
      apiUrl: this.data.apiUrl,
      token: this.data.token
    });
    wx.showToast({ title: "已保存", icon: "success" });
    this.onTest();
  },

  onClearToken() {
    clearToken();
    this.setData({ token: "", userName: "", userId: "", timezone: "" });
    wx.showToast({ title: "已清除 Token", icon: "none" });
  },

  onTest() {
    saveConfig({
      apiUrl: this.data.apiUrl,
      token: this.data.token
    });

    this.setData({ testing: true });
    return fetchMe()
      .then((response) => {
        this.setData({ testing: false });
        if (!response.ok || !response.data) {
          wx.showToast({
            title: response.error?.message || "连接失败",
            icon: "none"
          });
          this.setData({ userName: "", userId: "", timezone: "" });
          return;
        }
        const { user } = response.data;
        this.setData({
          userName: user.displayName,
          userId: user.id,
          timezone: user.timezone
        });
        wx.showToast({ title: "连接成功", icon: "success" });
      })
      .catch(() => {
        this.setData({ testing: false, userName: "", userId: "", timezone: "" });
        wx.showToast({ title: "无法连接 API", icon: "none" });
      });
  },

  onIssuePat() {
    saveConfig({
      apiUrl: this.data.apiUrl,
      token: this.data.token
    });

    this.setData({ issuing: true });
    issuePat("Miniapp Local")
      .then((response) => {
        this.setData({ issuing: false });
        if (!response.ok || !response.data) {
          wx.showToast({
            title: response.error?.message || "签发失败",
            icon: "none"
          });
          return;
        }
        saveConfig({ token: response.data.token });
        this.setData({ token: response.data.token });
        wx.showModal({
          title: "PAT 已签发",
          content: "Token 已保存到本地。",
          showCancel: false,
          success: () => this.onTest()
        });
      })
      .catch(() => {
        this.setData({ issuing: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
