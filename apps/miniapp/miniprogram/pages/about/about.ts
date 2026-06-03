import { fetchHealth, fetchMe } from "../../lib/api";
import { getConfig } from "../../lib/config";
import { MINIAPP_VERSION } from "../../lib/version";

Page({
  data: {
    miniappVersion: MINIAPP_VERSION,
    apiUrl: "",
    userId: "",
    loggedIn: false,
    healthSummary: "检查中…"
  },

  onShow() {
    const { apiUrl, token } = getConfig();
    this.setData({ apiUrl });
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
        const parts = [`${d.status || "unknown"}`];
        if (d.apiVersion) parts.push(`api ${d.apiVersion}`);
        if (d.releaseTag) parts.push(`tag ${d.releaseTag}`);
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
