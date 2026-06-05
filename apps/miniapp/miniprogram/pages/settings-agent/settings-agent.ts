import { createPat, listApiTokens } from "../../lib/api";
import { getConfig } from "../../lib/config";
import { formatShortDate } from "../../lib/format";
import {
  TOKEN_PRESETS,
  buildSettingsSnippet,
  defaultTokenName,
  expiresAtFromDays,
  findTokenPreset
} from "../../lib/token-presets";
import {
  isActiveTokenStatus,
  normalizeApiTokenSummary
} from "../../lib/token-status";

interface PatItem {
  id: string;
  name: string;
  tokenHint: string;
  status: string;
  expiresAt: string;
}

Page({
  data: {
    activePatItems: [] as PatItem[],
    inactivePatItems: [] as PatItem[],
    totalPatCount: 0,
    activePatCount: 0,
    inactivePatCount: 0,
    showInactive: false,
    patLoading: false,
    quickCreating: false
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
        const patItems = response.data.items.map((raw) => {
          const item = normalizeApiTokenSummary(raw);
          return {
            id: item.id,
            name: item.name,
            tokenHint: item.tokenHint || "aitodo_****",
            status: item.status,
            expiresAt: item.expiresAt ? formatShortDate(item.expiresAt) : "永不过期"
          };
        });
        const activePatItems = patItems.filter((item) => isActiveTokenStatus(item.status));
        const inactivePatItems = patItems.filter((item) => !isActiveTokenStatus(item.status));
        this.setData({
          activePatItems,
          inactivePatItems,
          totalPatCount: patItems.length,
          activePatCount: activePatItems.length,
          inactivePatCount: inactivePatItems.length,
          showInactive: inactivePatItems.length > 0 && activePatItems.length === 0
        });
      })
      .catch(() => {
        this.setData({ patLoading: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  onCreateToken() {
    if (this.data.quickCreating) return;
    wx.showActionSheet({
      itemList: [
        ...TOKEN_PRESETS.map((item) => item.actionLabel),
        "自定义名称和选项"
      ],
      success: (result) => {
        if (result.tapIndex >= TOKEN_PRESETS.length) {
          wx.navigateTo({ url: "/pages/settings-token-create/settings-token-create" });
          return;
        }
        const preset = TOKEN_PRESETS[result.tapIndex];
        const suggestedName = defaultTokenName();
        wx.showModal({
          title: "快速新建",
          content: `将创建「${suggestedName}」${preset.label}令牌。创建后会自动复制 CLI 配置。`,
          confirmText: "创建",
          success: (modalResult) => {
            if (!modalResult.confirm) return;
            this.quickCreate(preset.id, suggestedName);
          }
        });
      }
    });
  },

  quickCreate(presetId: string, name: string) {
    const preset = findTokenPreset(presetId);
    this.setData({ quickCreating: true });
    createPat({
      name,
      expiresAt: expiresAtFromDays(preset.ttlDays),
      maxIdleDays: preset.maxIdleDays
    })
      .then((response) => {
        this.setData({ quickCreating: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "创建失败", icon: "none" });
          return;
        }
        const token = response.data.token;
        const apiUrl = getConfig().apiUrl;
        const settingsSnippet = buildSettingsSnippet(apiUrl, token);
        wx.navigateTo({
          url: "/pages/settings-token-create/settings-token-create",
          success: (navResult) => {
            navResult.eventChannel.emit("created", {
              token,
              name: response.data!.name,
              tokenHint: response.data!.tokenHint || `aitodo_****${token.slice(-4)}`,
              settingsSnippet
            });
          }
        });
        this.loadPatList();
      })
      .catch(() => {
        this.setData({ quickCreating: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  onOpenHelp() {
    wx.showModal({
      title: "CLI 配置",
      content: "点「新建令牌」选择用途即可快速创建。创建后复制配置到电脑 ~/.ai-todo/settings.json。完整令牌只在创建成功时显示一次。",
      showCancel: false
    });
  },

  onToggleInactive() {
    this.setData({ showInactive: !this.data.showInactive });
  },

  onOpenDetail(e: { currentTarget: { dataset: { id: string } } }) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/settings-token-detail/settings-token-detail?id=${encodeURIComponent(id)}` });
  }
});
