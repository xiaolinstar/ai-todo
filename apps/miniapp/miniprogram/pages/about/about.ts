import { fetchHealth, fetchMe } from "../../lib/api";
import { getConfig } from "../../lib/config";
import { MINIAPP_VERSION } from "../../lib/version";
import { buildAppShareOptions, buildAppShareTimelineOptions } from "../../lib/share";

Page({
  data: {
    miniappVersion: MINIAPP_VERSION,
    userId: "",
    loggedIn: false,
    healthSummary: "检查中…"
  },

  onShareAppMessage() {
    return buildAppShareOptions();
  },

  onShareTimeline() {
    return buildAppShareTimelineOptions();
  },

  onShow() {
    const { token } = getConfig();
    if (token) {
      fetchMe().then((response) => {
        if (response.ok && response.data) {
          this.setData({
            loggedIn: true,
            userId: response.data.user.id
          });
        }
      });
    } else {
      this.setData({ loggedIn: false, userId: "" });
    }
    this.loadHealth();
  },

  loadHealth() {
    this.setData({ healthSummary: "检查中…" });
    fetchHealth()
      .then((response) => {
        if (!response.ok || !response.data) {
          this.setData({ healthSummary: response.error?.message || "无法连接 API" });
          return;
        }
        const d = response.data;
        const parts = [d.status === "ok" ? "已连接" : d.status || "unknown"];
        if (d.apiVersion) parts.push(`API ${d.apiVersion}`);
        if (d.releaseTag) parts.push(d.releaseTag);
        this.setData({ healthSummary: parts.join(" · ") });
      })
      .catch(() => {
        this.setData({ healthSummary: "无法连接 API" });
      });
  },

  onCopyUserId() {
    const { userId } = this.data;
    if (!userId) return;
    wx.setClipboardData({
      data: userId,
      success: () => wx.showToast({ title: "已复制", icon: "success" })
    });
  }
});
