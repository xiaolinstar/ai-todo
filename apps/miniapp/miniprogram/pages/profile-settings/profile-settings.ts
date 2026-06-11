import { fetchMe, updateProfile } from "../../lib/api";
import { markPrivacyConsented } from "../../lib/privacy";
import { markProfileSetupSeen } from "../../lib/config";
import { TODO_COLORS } from "../../lib/design-tokens";
import { avatarColor, getInitial } from "../../lib/format";

type PrivacyAuthorizationResolve = (result: {
  event: "agree" | "disagree";
  buttonId?: string;
}) => void;

Page({
  data: {
    userId: "",
    userUsername: "",
    displayName: "",
    avatarUrl: "",
    initial: "微",
    avatarColor: TODO_COLORS.primary,
    loading: true,
    saving: false,
    showPrivacyAuthorization: false
  },

  _savedDisplayName: "",
  _savedAvatarUrl: "",
  _privacyResolve: undefined as PrivacyAuthorizationResolve | undefined,

  onLoad() {
    this.loadProfile();
  },

  loadProfile() {
    this.setData({ loading: true });
    fetchMe()
      .then((response) => {
        this.setData({ loading: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "登录已过期", icon: "none" });
          setTimeout(() => wx.navigateBack(), 600);
          return;
        }
        const user = response.data.user;
        const userUsername = (user.username || "").trim() || user.id;
        const displayName = user.displayName || user.id;
        const avatarUrl = user.avatarUrl || "";
        this._savedDisplayName = displayName;
        this._savedAvatarUrl = avatarUrl;
        this.setData({
          userId: user.id,
          userUsername,
          displayName,
          avatarUrl,
          initial: avatarUrl ? getInitial(displayName) : "微",
          avatarColor: avatarColor(displayName || user.id)
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: "无法连接 API", icon: "none" });
      });
  },

  onChooseAvatar(e: { detail: { avatarUrl?: string } }) {
    const avatarUrl = e.detail.avatarUrl || "";
    if (!avatarUrl || avatarUrl === this.data.avatarUrl) return;
    this.setData({ avatarUrl }, () => {
      this.persistProfile();
    });
  },

  showPrivacyAuthorization(resolve: PrivacyAuthorizationResolve) {
    this._privacyResolve = resolve;
    this.setData({ showPrivacyAuthorization: true });
  },

  onPrivacyAgree() {
    markPrivacyConsented();
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

  onNameInput(e: { detail: { value: string } }) {
    const displayName = e.detail.value;
    this.setData({
      displayName,
      initial: this.data.avatarUrl ? this.data.initial : getInitial(displayName || this.data.userId),
      avatarColor: avatarColor(displayName || this.data.userId)
    });
  },

  onNameBlur() {
    const displayName = this.data.displayName.trim();
    if (!displayName) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      this.setData({ displayName: this._savedDisplayName });
      return;
    }
    if (displayName !== this.data.displayName) {
      this.setData({ displayName });
    }
    this.persistProfile();
  },

  persistProfile() {
    if (this.data.loading || this.data.saving) return;
    const displayName = this.data.displayName.trim();
    const avatarUrl = this.data.avatarUrl || "";
    if (!displayName) return;
    if (
      displayName === this._savedDisplayName &&
      avatarUrl === this._savedAvatarUrl
    ) {
      return;
    }

    this.setData({ saving: true, displayName });
    updateProfile({
      displayName,
      avatarUrl: avatarUrl || undefined
    })
      .then((response) => {
        this.setData({ saving: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "保存失败", icon: "none" });
          return;
        }
        this._savedDisplayName = displayName;
        this._savedAvatarUrl = avatarUrl;
        markProfileSetupSeen(response.data.user.id);
        wx.showToast({ title: "已更新", icon: "success" });
      })
      .catch(() => {
        this.setData({ saving: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
