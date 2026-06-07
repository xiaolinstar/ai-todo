import { fetchMe, updateProfile } from "../../lib/api";
import { hasValidSession, loginWithWechat } from "../../lib/auth";
import {
  buildMineMenuSections,
  navigateSettingsItem,
  type SettingsMenuItem,
  type SettingsMenuSection
} from "../../lib/settings-menu";
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
import { requirePrivacyAuthorization } from "../../lib/privacy";
import { TODO_COLORS } from "../../lib/design-tokens";
import { updateTabBarSelected } from "../../lib/tab-bar";
import { buildAppShareOptions, buildAppShareTimelineOptions } from "../../lib/share";

type PrivacyAuthorizationResolve = (result: {
  event: "agree" | "disagree";
  buttonId?: string;
}) => void;

Page({
  data: {
    userName: "",
    userId: "",
    userUsername: "",
    avatarUrl: "",
    profileSubtitle: "微信登录以使用全部设置",
    showProfileSetup: false,
    showPrivacyAuthorization: false,
    setupAvatarUrl: "",
    setupNameInput: "",
    timezone: "",
    initial: "?",
    avatarColor: TODO_COLORS.primary,
    loggedIn: false,
    loggingIn: false,
    profileSaving: false,
    showDevControls: false,
    menuSections: [] as SettingsMenuSection[]
  },

  _privacyResolve: undefined as PrivacyAuthorizationResolve | undefined,

  onShareAppMessage() {
    return buildAppShareOptions();
  },

  onShareTimeline() {
    return buildAppShareTimelineOptions();
  },

  onShow() {
    updateTabBarSelected(3);
    this.setData({ showDevControls: isDevelopEnv() });
    if (getConfig().apiUrl) {
      this.refreshSession(false);
    } else {
      this.syncMenu();
    }
  },

  syncMenu() {
    const { loggedIn, showDevControls } = this.data;
    const profileSubtitle = loggedIn ? "" : "微信登录以使用全部设置";
    this.setData({
      menuSections: buildMineMenuSections(loggedIn, showDevControls),
      profileSubtitle
    });
  },

  onWechatLogin() {
    requirePrivacyAuthorization().then((authorized) => {
      if (!authorized) {
        wx.showToast({ title: "需同意隐私指引后登录", icon: "none" });
        return;
      }
      this.startWechatLogin();
    });
  },

  startWechatLogin() {
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
        this.syncMenu();
      })
      .catch(() => {
        this.setData({ loggingIn: false });
        wx.showToast({ title: "微信登录失败", icon: "none" });
      });
  },

  refreshSession(showToast: boolean) {
    return hasValidSession()
      .then((loggedIn) => {
        if (!loggedIn) {
          if (getConfig().token) {
            clearToken();
          }
          this.resetProfile();
          this.syncMenu();
          return;
        }

        return fetchMe().then((response) => {
          if (!response.ok || !response.data) {
            clearToken();
            this.resetProfile();
            this.syncMenu();
            if (showToast) {
              wx.showToast({ title: response.error?.message || "登录已过期", icon: "none" });
            }
            return;
          }
          this.applyUser(response.data.user, showToast);
          this.syncMenu();
        });
      })
      .catch(() => {
        this.resetProfile();
        this.syncMenu();
        if (showToast) {
          wx.showToast({ title: "无法连接 API", icon: "none" });
        }
      });
  },

  applyUser(
    user: {
      displayName: string;
      id: string;
      username?: string;
      timezone: string;
      avatarUrl?: string;
    },
    showToast: boolean
  ) {
    const userUsername = (user.username || "").trim() || user.id;
    this.setData({
      userName: user.displayName,
      userId: user.id,
      userUsername,
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
      userUsername: "",
      avatarUrl: "",
      showProfileSetup: false,
      setupAvatarUrl: "",
      setupNameInput: "",
      timezone: "",
      initial: "?",
      avatarColor: TODO_COLORS.primary,
      loggedIn: false,
      profileSaving: false
    });
  },

  onProfileCardTap() {
    if (!this.data.loggedIn) {
      this.onWechatLogin();
      return;
    }
    wx.navigateTo({ url: "/pages/profile-settings/profile-settings" });
  },

  onMenuItemTap(e: { currentTarget: { dataset: { sectionId: string; itemId: string } } }) {
    const { sectionId, itemId } = e.currentTarget.dataset;
    const section = this.data.menuSections.find(
      (s: SettingsMenuSection) => s.id === sectionId
    );
    const item = section?.items.find((i: SettingsMenuItem) => i.id === itemId);
    if (!item) return;
    if (item.requireLogin && !this.data.loggedIn) {
      wx.showToast({ title: "请先微信登录", icon: "none" });
      return;
    }
    navigateSettingsItem(item);
  },

  showPrivacyAuthorization(resolve: PrivacyAuthorizationResolve) {
    this._privacyResolve = resolve;
    this.setData({ showPrivacyAuthorization: true });
  },

  onPrivacyAgree() {
    if (this._privacyResolve) {
      this._privacyResolve({ event: "agree", buttonId: "privacy-agree" });
      this._privacyResolve = undefined;
    }
    this.setData({ showPrivacyAuthorization: false });
  },

  onPrivacyDisagree() {
    if (this._privacyResolve) {
      this._privacyResolve({ event: "disagree", buttonId: "privacy-disagree" });
      this._privacyResolve = undefined;
    }
    this.setData({ showPrivacyAuthorization: false });
    wx.showToast({ title: "已取消隐私授权", icon: "none" });
  },

  openProfileSetup() {
    if (!this.data.userId) return;
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
    this.setData({ setupAvatarUrl: avatarUrl }, () => {
      this.trySaveProfileSetup();
    });
  },

  onSetupNameInput(e: { detail: { value: string } }) {
    this.setData({ setupNameInput: e.detail.value });
  },

  onSetupNameBlur() {
    this.trySaveProfileSetup();
  },

  onCancelProfileSetup() {
    if (this.data.userId) {
      markProfileSetupSeen(this.data.userId);
    }
    this.setData({ showProfileSetup: false });
  },

  trySaveProfileSetup() {
    if (this.data.profileSaving) return;
    const displayName = this.data.setupNameInput.trim();
    if (!displayName) return;
    this.setData({ setupNameInput: displayName });
    this.saveProfile(displayName, this.data.setupAvatarUrl || undefined);
  },

  saveProfile(displayName: string, avatarUrl?: string) {
    this.setData({ profileSaving: true });
    updateProfile({ displayName, avatarUrl })
      .then((response) => {
        this.setData({ profileSaving: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "保存失败", icon: "none" });
          return;
        }
        this.applyUser(response.data.user, false);
        markProfileSetupSeen(response.data.user.id);
        this.setData({ showProfileSetup: false });
        this.syncMenu();
        wx.showToast({ title: "资料已更新", icon: "success" });
      })
      .catch(() => {
        this.setData({ profileSaving: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
