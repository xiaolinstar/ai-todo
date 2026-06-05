import { ApiTokenSummary, listApiTokens, revokeApiToken } from "../../lib/api";
import { getConfig } from "../../lib/config";
import { TODO_MODAL_CONFIRM_DANGER } from "../../lib/design-tokens";
import { formatShortDate } from "../../lib/format";

const STATUS_LABELS: Record<string, string> = {
  active: "有效",
  expired: "已过期",
  revoked: "已吊销",
  idle_revoked: "久未使用失效"
};

function statusClass(status: string): string {
  if (status === "active") return "status-active";
  if (status === "idle_revoked") return "status-warning";
  return "status-muted";
}

function formatDate(value?: string): string {
  return value ? formatShortDate(value) : "-";
}

Page({
  data: {
    tokenId: "",
    loading: true,
    revoking: false,
    found: false,
    name: "",
    tokenHint: "aitodo_****",
    status: "",
    statusLabel: "",
    statusClass: "",
    createdAt: "-",
    lastUsedAt: "未使用",
    expiresAt: "永不过期",
    maxIdleDays: "不限制空闲",
    scopes: "",
    revoked: false,
    commandTemplate: ""
  },

  onLoad(query: { id?: string }) {
    this.setData({ tokenId: query.id || "" });
    this.loadToken();
  },

  loadToken() {
    if (!this.data.tokenId) {
      this.setData({ loading: false, found: false });
      return;
    }
    this.setData({ loading: true });
    listApiTokens()
      .then((response) => {
        this.setData({ loading: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "加载失败", icon: "none" });
          return;
        }
        const token = response.data.items.find((item) => item.id === this.data.tokenId);
        if (!token) {
          this.setData({ found: false });
          return;
        }
        this.applyToken(token);
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  applyToken(token: ApiTokenSummary) {
    const apiUrl = getConfig().apiUrl;
    this.setData({
      found: true,
      name: token.name,
      tokenHint: token.tokenHint || "aitodo_****",
      status: token.status,
      statusLabel: STATUS_LABELS[token.status] || token.status,
      statusClass: statusClass(token.status),
      createdAt: formatDate(token.createdAt),
      lastUsedAt: token.lastUsedAt ? formatShortDate(token.lastUsedAt) : "未使用",
      expiresAt: token.expiresAt ? formatShortDate(token.expiresAt) : "永不过期",
      maxIdleDays: token.maxIdleDays ? `${token.maxIdleDays} 天未用失效` : "不限制空闲",
      scopes: token.scopes.join(", "),
      revoked: token.status === "revoked",
      commandTemplate: `ai-todo login --url ${apiUrl} --token <创建时复制的完整令牌>`
    });
  },

  onCopyCommandTemplate() {
    wx.setClipboardData({
      data: this.data.commandTemplate,
      success: () => wx.showToast({ title: "已复制", icon: "success" })
    });
  },

  onRevoke() {
    if (this.data.revoked || this.data.revoking) return;
    wx.showModal({
      title: "吊销令牌",
      content: `确定吊销「${this.data.name}」？电脑端工具将无法继续使用此令牌。`,
      confirmColor: TODO_MODAL_CONFIRM_DANGER,
      success: (result) => {
        if (!result.confirm) return;
        this.setData({ revoking: true });
        revokeApiToken(this.data.tokenId)
          .then((response) => {
            this.setData({ revoking: false });
            if (!response.ok) {
              wx.showToast({ title: response.error?.message || "吊销失败", icon: "none" });
              return;
            }
            wx.showToast({ title: "已吊销", icon: "success" });
            this.loadToken();
          })
          .catch(() => {
            this.setData({ revoking: false });
            wx.showToast({ title: "网络错误", icon: "none" });
          });
      }
    });
  }
});
