import { fetchMe, updateProfile } from "../../lib/api";
import { markProfileSetupSeen } from "../../lib/config";
import { avatarColor, getInitial } from "../../lib/format";

type PrivacyAuthorizationResolve = (result: {
  event: "agree" | "disagree";
  buttonId?: string;
}) => void;

Page({
  data: {
    userId: "",
    displayName: "",
    avatarUrl: "",
    initial: "微",
    avatarColor: "#007AFF",
    loading: true,
    saving: false,
    showPrivacyAuthorization: false
  },

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
        this.setData({
          userId: user.id,
          displayName: user.displayName || user.id,
          avatarUrl: user.avatarUrl || "",
          initial: user.avatarUrl ? getInitial(user.displayName) : "微",
          avatarColor: avatarColor(user.displayName || user.id)
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: "无法连接 API", icon: "none" });
      });
  },

  onChooseAvatar(e: { detail: { avatarUrl?: string } }) {
    const avatarUrl = e.detail.avatarUrl || "";
    if (!avatarUrl) return;
    this.setData({ avatarUrl });
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

  onNameInput(e: { detail: { value: string } }) {
    const displayName = e.detail.value;
    this.setData({
      displayName,
      initial: this.data.avatarUrl ? this.data.initial : getInitial(displayName || this.data.userId),
      avatarColor: avatarColor(displayName || this.data.userId)
    });
  },

  onSubmit(e?: { detail?: { value?: { nickname?: string } } }) {
    const submittedName = e?.detail?.value?.nickname;
    const displayName =
      typeof submittedName === "string" ? submittedName.trim() : this.data.displayName.trim();
    if (!displayName) {
      wx.showToast({ title: "请输入昵称", icon: "none" });
      return;
    }

    this.setData({ saving: true, displayName });
    updateProfile({
      displayName,
      avatarUrl: this.data.avatarUrl || undefined
    })
      .then((response) => {
        this.setData({ saving: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "保存失败", icon: "none" });
          return;
        }
        markProfileSetupSeen(response.data.user.id);
        wx.showToast({ title: "已保存", icon: "success" });
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => {
        this.setData({ saving: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
