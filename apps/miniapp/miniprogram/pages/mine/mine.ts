import { fetchMe, issuePat } from "../../lib/api";
import { avatarColor, getInitial } from "../../lib/format";
import { clearToken, getConfig, saveConfig } from "../../lib/config";
import { updateTabBarSelected } from "../../lib/tab-bar";

Page({
  data: {
    apiUrl: "",
    token: "",
    userName: "",
    userId: "",
    timezone: "",
    initial: "?",
    avatarColor: "#007AFF",
    connected: false,
    testing: false,
    issuing: false
  },

  onShow() {
    updateTabBarSelected(3);
    const config = getConfig();
    this.setData({
      apiUrl: config.apiUrl,
      token: config.token
    });
    if (config.apiUrl) {
      this.testConnection(false);
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
    this.testConnection(true);
  },

  onClearToken() {
    clearToken();
    this.setData({
      token: "",
      userName: "",
      userId: "",
      timezone: "",
      initial: "?",
      avatarColor: "#007AFF",
      connected: false
    });
    wx.showToast({ title: "已清除 Token", icon: "none" });
  },

  onTestConnection() {
    this.testConnection(true);
  },

  testConnection(showToast: boolean) {
    saveConfig({
      apiUrl: this.data.apiUrl,
      token: this.data.token
    });

    this.setData({ testing: true });
    return fetchMe()
      .then((response) => {
        this.setData({ testing: false });
        if (!response.ok || !response.data) {
          if (showToast) {
            wx.showToast({
              title: response.error?.message || "连接失败",
              icon: "none"
            });
          }
          this.setData({
            userName: "",
            userId: "",
            timezone: "",
            initial: "?",
            avatarColor: "#007AFF",
            connected: false
          });
          return;
        }
        const { user } = response.data;
        this.setData({
          userName: user.displayName,
          userId: user.id,
          timezone: user.timezone,
          initial: getInitial(user.displayName),
          avatarColor: avatarColor(user.displayName),
          connected: true
        });
        if (showToast) {
          wx.showToast({ title: "连接成功", icon: "success" });
        }
      })
      .catch(() => {
        this.setData({
          testing: false,
          userName: "",
          userId: "",
          timezone: "",
          initial: "?",
          avatarColor: "#007AFF",
          connected: false
        });
        if (showToast) {
          wx.showToast({ title: "无法连接 API", icon: "none" });
        }
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
          success: () => this.testConnection(true)
        });
      })
      .catch(() => {
        this.setData({ issuing: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
