import {
  listApiTokens,
  revokeApiToken
} from "../../lib/api";
import { TODO_MODAL_CONFIRM_DANGER } from "../../lib/design-tokens";
import { formatShortDate } from "../../lib/format";

interface PatItem {
  id: string;
  name: string;
  tokenHint: string;
  status: string;
  statusLabel: string;
  statusClass: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  maxIdleDays: string;
  revoked: boolean;
  expired: boolean;
}

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

Page({
  data: {
    activePatItems: [] as PatItem[],
    inactivePatItems: [] as PatItem[],
    totalPatCount: 0,
    activePatCount: 0,
    inactivePatCount: 0,
    showInactive: false,
    patLoading: false
  },

  onShow() {
    this.loadPatList();
  },

  loadPatList() {
    this.setData({ patLoading: true });
    listApiTokens()
      .then((response) => {
        this.setData({ patLoading: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "加载失败", icon: "none" });
          return;
        }
        const patItems = response.data.items.map((item) => ({
          id: item.id,
          name: item.name,
          tokenHint: item.tokenHint || "aitodo_****",
          status: item.status,
          statusLabel: STATUS_LABELS[item.status] || item.status,
          statusClass: statusClass(item.status),
          createdAt: item.createdAt ? formatShortDate(item.createdAt) : "-",
          lastUsedAt: item.lastUsedAt ? formatShortDate(item.lastUsedAt) : "未使用",
          expiresAt: item.expiresAt ? formatShortDate(item.expiresAt) : "永不过期",
          maxIdleDays: item.maxIdleDays ? `${item.maxIdleDays} 天未用失效` : "不限制空闲",
          revoked: item.status === "revoked",
          expired: item.status === "expired" || item.status === "idle_revoked"
        }));
        this.setData({
          activePatItems: patItems.filter((item) => item.status === "active"),
          inactivePatItems: patItems.filter((item) => item.status !== "active"),
          totalPatCount: patItems.length,
          activePatCount: patItems.filter((item) => item.status === "active").length,
          inactivePatCount: patItems.filter((item) => item.status !== "active").length
        });
      })
      .catch(() => {
        this.setData({ patLoading: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  onCreateToken() {
    wx.navigateTo({ url: "/pages/settings-token-create/settings-token-create" });
  },

  onOpenHelp() {
    wx.showModal({
      title: "CLI 配置",
      content: "新建令牌后复制登录命令，在电脑终端执行即可连接 ai-todo。完整令牌只在创建成功时显示一次。",
      showCancel: false
    });
  },

  onToggleInactive() {
    this.setData({ showInactive: !this.data.showInactive });
  },

  onOpenDetail(e: { currentTarget: { dataset: { id: string } } }) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/settings-token-detail/settings-token-detail?id=${encodeURIComponent(id)}` });
  },

  onRevokePat(e: { currentTarget: { dataset: { id: string; name: string } } }) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: "吊销令牌",
      content: `确定吊销「${name}」？`,
      success: (result) => {
        if (!result.confirm) return;
        revokeApiToken(id).then((response) => {
          if (!response.ok) {
            wx.showToast({ title: response.error?.message || "吊销失败", icon: "none" });
            return;
          }
          wx.showToast({ title: "已吊销", icon: "success" });
          this.loadPatList();
        });
      }
    });
  }
});
