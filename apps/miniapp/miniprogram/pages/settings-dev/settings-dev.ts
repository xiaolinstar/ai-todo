import { fetchHealth, fetchMe, revokeAllApiTokens } from "../../lib/api";
import { clearProfileSetupSeen, getConfig, getDefaultApiUrl } from "../../lib/config";

Page({
  data: {
    apiUrl: "",
    apiStatus: "检查中…",
    userId: ""
  },

  onShow() {
    const { apiUrl } = getConfig();
    this.setData({ apiUrl: apiUrl || getDefaultApiUrl() });
    this.probeApi();
    fetchMe().then((response) => {
      if (response.ok && response.data) {
        this.setData({ userId: response.data.user.id });
      }
    });
  },

  probeApi() {
    this.setData({ apiStatus: "检查中…" });
    fetchHealth()
      .then((response) => {
        if (!response.ok || !response.data) {
          this.setData({ apiStatus: response.error?.message || "无法连接" });
          return;
        }
        const d = response.data;
        const parts = [d.status === "ok" ? "已连接" : d.status];
        if (d.apiVersion) parts.push(`API ${d.apiVersion}`);
        if (d.releaseTag) parts.push(d.releaseTag);
        this.setData({ apiStatus: parts.join(" · ") });
      })
      .catch(() => {
        this.setData({ apiStatus: "无法连接" });
      });
  },

  onResetProfileSetup() {
    const { userId } = this.data;
    if (!userId) {
      wx.showToast({ title: "请先登录", icon: "none" });
      return;
    }
    clearProfileSetupSeen(userId);
    wx.showToast({ title: "已重置，返回「我的」将弹出确认", icon: "none" });
  },

  onRevokeAllPats() {
    wx.showModal({
      title: "清理全部 CLI 令牌",
      content: "确定吊销当前账号下所有 CLI 令牌？",
      success: (result) => {
        if (!result.confirm) return;
        revokeAllApiTokens().then((response) => {
          if (!response.ok) {
            wx.showToast({ title: response.error?.message || "失败", icon: "none" });
            return;
          }
          wx.showToast({ title: "已清理", icon: "success" });
        });
      }
    });
  }
});
