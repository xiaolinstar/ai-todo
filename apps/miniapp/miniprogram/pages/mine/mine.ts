import { fetchMe, issuePat } from "../../lib/api";
import { ensureAuth, loginWithWechat } from "../../lib/auth";
import { avatarColor, getInitial } from "../../lib/format";
import { clearToken, getConfig, isDevelopEnv, saveConfig } from "../../lib/config";
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
    issuing: false,
    loggingIn: false,
    showDevControls: false
  },

  onShow() {
    updateTabBarSelected(3);
    const config = getConfig();
    this.setData({
      apiUrl: config.apiUrl,
      token: config.token,
      showDevControls: isDevelopEnv()
    });
    if (config.apiUrl) {
      this.bootstrapConnection(false);
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
      apiUrl: isDevelopEnv() ? this.data.apiUrl : undefined,
      token: this.data.token
    });
    wx.showToast({ title: "已保存", icon: "success" });
    this.bootstrapConnection(true);
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
    this.bootstrapConnection(true);
  },

  onWechatLogin() {
    if (isDevelopEnv()) {
      saveConfig({ apiUrl: this.data.apiUrl });
    }
    this.setData({ loggingIn: true });
    loginWithWechat()
      .then((response) => {
        this.setData({ loggingIn: false });
        if (!response.ok || !response.data) {
          const code = response.error?.code || "";
          const hint = response.error?.message || "微信登录失败";
          const title =
            code === "DATABASE_ERROR"
              ? "数据库需迁移"
              : hint.length > 20
                ? "微信登录失败"
                : hint;
          wx.showToast({ title, icon: "none", duration: 2500 });
          return;
        }
        saveConfig({ token: response.data.accessToken });
        this.setData({ token: response.data.accessToken });
        this.applyUser(response.data.user, true);
      })
      .catch(() => {
        this.setData({ loggingIn: false });
        wx.showToast({ title: "微信登录失败", icon: "none" });
      });
  },

  bootstrapConnection(showToast: boolean) {
    saveConfig({
      apiUrl: isDevelopEnv() ? this.data.apiUrl : undefined,
      token: this.data.token
    });

    this.setData({ testing: true });
    return ensureAuth()
      .then((authenticated) => {
        const config = getConfig();
        this.setData({ token: config.token });
        if (!authenticated) {
          return this.testConnection(showToast);
        }
        return fetchMe().then((response) => {
          this.setData({ testing: false });
          if (!response.ok || !response.data) {
            if (showToast) {
              wx.showToast({
                title: response.error?.message || "连接失败",
                icon: "none"
              });
            }
            this.resetProfile();
            return;
          }
          this.applyUser(response.data.user, showToast);
        });
      })
      .catch(() => {
        this.setData({ testing: false });
        this.resetProfile();
        if (showToast) {
          wx.showToast({ title: "无法连接 API", icon: "none" });
        }
      });
  },

  testConnection(showToast: boolean) {
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
          this.resetProfile();
          return;
        }
        this.applyUser(response.data.user, showToast);
      })
      .catch(() => {
        this.setData({ testing: false });
        this.resetProfile();
        if (showToast) {
          wx.showToast({ title: "无法连接 API", icon: "none" });
        }
      });
  },

  applyUser(
    user: { displayName: string; id: string; timezone: string },
    showToast: boolean
  ) {
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
  },

  resetProfile() {
    this.setData({
      userName: "",
      userId: "",
      timezone: "",
      initial: "?",
      avatarColor: "#007AFF",
      connected: false
    });
  },

  onIssuePat() {
    saveConfig({
      apiUrl: isDevelopEnv() ? this.data.apiUrl : undefined,
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
          success: () => this.bootstrapConnection(true)
        });
      })
      .catch(() => {
        this.setData({ issuing: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
