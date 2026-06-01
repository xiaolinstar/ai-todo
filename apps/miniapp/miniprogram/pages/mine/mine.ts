import {
  createPat as createPatRequest,
  fetchMe,
  listApiTokens,
  revokeAllApiTokens,
  revokeApiToken,
  updateProfile
} from "../../lib/api";
import { hasValidSession, loginWithWechat } from "../../lib/auth";
import { avatarColor, getInitial } from "../../lib/format";
import {
  clearToken,
  clearProfileSetupSeen,
  getConfig,
  hasSeenProfileSetup,
  isDevelopEnv,
  markProfileSetupSeen,
  saveConfig
} from "../../lib/config";
import { updateTabBarSelected } from "../../lib/tab-bar";

interface PatItem {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string;
}

Page({
  data: {
    userName: "",
    userId: "",
    avatarUrl: "",
    showProfileSetup: false,
    setupAvatarUrl: "",
    setupNameInput: "",
    timezone: "",
    initial: "?",
    avatarColor: "#007AFF",
    loggedIn: false,
    testing: false,
    loggingIn: false,
    profileSaving: false,
    showDevControls: false,
    patItems: [] as PatItem[],
    patLoading: false,
    creatingPat: false,
    patName: "",
    newPatToken: "",
    patSubmitting: false
  },

  onShow() {
    updateTabBarSelected(3);
    const config = getConfig();
    this.setData({
      showDevControls: isDevelopEnv()
    });
    if (config.apiUrl) {
      this.refreshSession(false);
    }
  },

  onWechatLogin() {
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
        this.applyUser(response.data.user, true);
        this.openProfileSetupIfNeeded();
        this.loadPatList();
      })
      .catch(() => {
        this.setData({ loggingIn: false });
        wx.showToast({ title: "微信登录失败", icon: "none" });
      });
  },

  refreshSession(showToast: boolean) {
    this.setData({ testing: true });
    return hasValidSession()
      .then((loggedIn) => {
        if (!loggedIn) {
          if (getConfig().token) {
            clearToken();
          }
          this.setData({ testing: false, loggedIn: false });
          this.resetProfile();
          return;
        }

        return fetchMe().then((response) => {
          this.setData({ testing: false });
          if (!response.ok || !response.data) {
            clearToken();
            this.setData({ loggedIn: false });
            this.resetProfile();
            if (showToast) {
              wx.showToast({
                title: response.error?.message || "登录已过期",
                icon: "none"
              });
            }
            return;
          }
          this.applyUser(response.data.user, showToast);
          this.loadPatList();
        });
      })
      .catch(() => {
        this.setData({ testing: false, loggedIn: false });
        this.resetProfile();
        if (showToast) {
          wx.showToast({ title: "无法连接 API", icon: "none" });
        }
      });
  },

  applyUser(
    user: { displayName: string; id: string; timezone: string; avatarUrl?: string },
    showToast: boolean
  ) {
    this.setData({
      userName: user.displayName,
      userId: user.id,
      avatarUrl: user.avatarUrl || "",
      timezone: user.timezone,
      initial: user.avatarUrl ? getInitial(user.displayName) : "微",
      avatarColor: avatarColor(user.displayName),
      loggedIn: true
    });
    if (showToast) {
      wx.showToast({ title: "已登录", icon: "success" });
    }
  },

  resetProfile() {
    this.setData({
      userName: "",
      userId: "",
      avatarUrl: "",
      showProfileSetup: false,
      setupAvatarUrl: "",
      setupNameInput: "",
      timezone: "",
      initial: "?",
      avatarColor: "#007AFF",
      loggedIn: false,
      patItems: [],
      creatingPat: false,
      profileSaving: false,
      newPatToken: ""
    });
  },

  onLogout() {
    clearToken();
    this.resetProfile();
    wx.showToast({ title: "已退出登录", icon: "none" });
  },

  onAuthButtonTap() {
    if (this.data.loggedIn) {
      this.onLogout();
      return;
    }
    this.onWechatLogin();
  },

  openProfileSetup() {
    if (!this.data.userId) {
      return;
    }
    const setupNameInput =
      !this.data.userName || this.data.userName === "微信用户"
        ? this.data.userId
        : this.data.userName;
    this.setData({
      showProfileSetup: true,
      setupAvatarUrl: this.data.avatarUrl,
      setupNameInput
    });
  },

  openProfileSetupIfNeeded() {
    if (!this.data.userId || hasSeenProfileSetup(this.data.userId)) {
      return;
    }
    this.openProfileSetup();
  },

  onChooseSetupAvatar(e: { detail: { avatarUrl?: string } }) {
    const avatarUrl = e.detail.avatarUrl || "";
    if (!avatarUrl) return;
    this.setData({ setupAvatarUrl: avatarUrl });
  },

  onSetupNameInput(e: { detail: { value: string } }) {
    this.setData({ setupNameInput: e.detail.value });
  },

  onCancelProfileSetup() {
    if (this.data.userId) {
      markProfileSetupSeen(this.data.userId);
    }
    this.setData({ showProfileSetup: false });
  },

  onResetProfileSetupForDev() {
    if (!this.data.userId) {
      return;
    }
    clearProfileSetupSeen(this.data.userId);
    this.openProfileSetup();
  },

  onSaveProfileSetup(e?: { detail?: { value?: { nickname?: string } } }) {
    const submittedName = e?.detail?.value?.nickname;
    const displayName =
      typeof submittedName === "string"
        ? submittedName.trim()
        : this.data.setupNameInput.trim();
    if (!displayName) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      return;
    }
    this.setData({ setupNameInput: displayName });
    this.saveProfile(displayName, this.data.setupAvatarUrl || undefined, "资料已保存");
  },

  saveProfile(displayName: string, avatarUrl?: string, successTitle = "资料已保存") {
    this.setData({ profileSaving: true });
    updateProfile({
      displayName,
      avatarUrl
    })
      .then((response) => {
        this.setData({ profileSaving: false });
        if (!response.ok || !response.data) {
          wx.showToast({
            title: response.error?.message || "保存失败",
            icon: "none"
          });
          return;
        }
        this.applyUser(response.data.user, false);
        markProfileSetupSeen(response.data.user.id);
        this.setData({ showProfileSetup: false });
        wx.showToast({ title: successTitle, icon: "success" });
      })
      .catch(() => {
        this.setData({ profileSaving: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  loadPatList() {
    if (!this.data.loggedIn) {
      return;
    }
    this.setData({ patLoading: true });
    listApiTokens()
      .then((response) => {
        this.setData({ patLoading: false });
        if (!response.ok || !response.data) {
          return;
        }
        const patItems = response.data.items.map((item) => ({
          id: item.id,
          name: item.name,
          createdAt: this.formatPatDate(item.createdAt),
          lastUsedAt: item.lastUsedAt ? this.formatPatDate(item.lastUsedAt) : "未使用"
        }));
        this.setData({ patItems });
      })
      .catch(() => {
        this.setData({ patLoading: false });
      });
  },

  formatPatDate(value?: string): string {
    if (!value) {
      return "";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value.slice(0, 10);
    }
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  },

  onStartCreatePat() {
    this.setData({ creatingPat: true, patName: "", newPatToken: "" });
  },

  onCancelCreatePat() {
    this.setData({ creatingPat: false, patName: "" });
  },

  onPatNameInput(e: { detail: { value: string } }) {
    this.setData({ patName: e.detail.value });
  },

  onConfirmCreatePat() {
    const name = this.data.patName.trim();
    if (!name) {
      wx.showToast({ title: "请输入令牌名称", icon: "none" });
      return;
    }

    this.setData({ patSubmitting: true });
    createPatRequest(name)
      .then((response) => {
        this.setData({ patSubmitting: false, creatingPat: false, patName: "" });
        if (!response.ok || !response.data) {
          wx.showToast({
            title: response.error?.message || "创建失败",
            icon: "none"
          });
          return;
        }
        this.setData({ newPatToken: response.data.token });
        this.loadPatList();
      })
      .catch(() => {
        this.setData({ patSubmitting: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  onCopyPat() {
    if (!this.data.newPatToken) {
      return;
    }
    wx.setClipboardData({
      data: this.data.newPatToken,
      success: () => {
        wx.showToast({ title: "已复制", icon: "success" });
      }
    });
  },

  onDismissPatReveal() {
    this.setData({ newPatToken: "" });
  },

  onRevokePat(e: { currentTarget: { dataset: { id: string; name: string } } }) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: "吊销令牌",
      content: `确定吊销「${name}」？使用此令牌的 CLI 将无法继续访问。`,
      success: (result) => {
        if (!result.confirm) {
          return;
        }
        revokeApiToken(id).then((response) => {
          if (!response.ok) {
            wx.showToast({
              title: response.error?.message || "吊销失败",
              icon: "none"
            });
            return;
          }
          wx.showToast({ title: "已吊销", icon: "success" });
          this.loadPatList();
        });
      }
    });
  },

  onRevokeAllPats() {
    wx.showModal({
      title: "清理全部 CLI 令牌",
      content: "将吊销当前账号下所有 CLI 令牌（开发环境常用）。确定继续？",
      success: (result) => {
        if (!result.confirm) {
          return;
        }
        revokeAllApiTokens().then((response) => {
          if (!response.ok) {
            wx.showToast({
              title: response.error?.message || "清理失败",
              icon: "none"
            });
            return;
          }
          wx.showToast({ title: "已清理", icon: "success" });
          this.loadPatList();
        });
      }
    });
  }
});
