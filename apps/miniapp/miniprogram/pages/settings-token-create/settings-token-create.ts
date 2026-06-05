import { createPat } from "../../lib/api";
import { getConfig } from "../../lib/config";

interface TokenPreset {
  id: string;
  label: string;
  description: string;
  ttlDays?: number;
  maxIdleDays: number;
}

const PRESETS: TokenPreset[] = [
  { id: "daily", label: "日常使用", description: "180 天到期 · 90 天未用失效", ttlDays: 180, maxIdleDays: 90 },
  { id: "debug", label: "短期调试", description: "30 天到期 · 30 天未用失效", ttlDays: 30, maxIdleDays: 30 },
  { id: "long", label: "长期使用", description: "永不过期 · 90 天未用失效", maxIdleDays: 90 }
];

function expiresAtFromDays(days?: number): string | undefined {
  if (!days) return undefined;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return expiresAt.toISOString();
}

Page({
  data: {
    presets: PRESETS,
    selectedPreset: "daily",
    name: "",
    customExpiresAt: "",
    customMaxIdleDays: "",
    showAdvanced: false,
    submitting: false,
    createdToken: "",
    createdName: "",
    createdId: "",
    loginCommand: ""
  },

  onNameInput(e: { detail: { value: string } }) {
    this.setData({ name: e.detail.value });
  },

  onPresetTap(e: { currentTarget: { dataset: { id: string } } }) {
    this.setData({ selectedPreset: e.currentTarget.dataset.id });
  },

  onToggleAdvanced() {
    this.setData({ showAdvanced: !this.data.showAdvanced });
  },

  onExpiresInput(e: { detail: { value: string } }) {
    this.setData({ customExpiresAt: e.detail.value });
  },

  onMaxIdleInput(e: { detail: { value: string } }) {
    this.setData({ customMaxIdleDays: e.detail.value });
  },

  onCreate() {
    const name = this.data.name.trim();
    if (!name) {
      wx.showToast({ title: "请输入令牌名称", icon: "none" });
      return;
    }

    const preset = PRESETS.find((item) => item.id === this.data.selectedPreset) || PRESETS[0];
    const idleRaw = this.data.customMaxIdleDays.trim();
    const maxIdleDays = idleRaw ? Number(idleRaw) : preset.maxIdleDays;
    if (!Number.isInteger(maxIdleDays) || maxIdleDays <= 0) {
      wx.showToast({ title: "空闲天数需为正整数", icon: "none" });
      return;
    }

    this.setData({ submitting: true });
    createPat({
      name,
      expiresAt: this.data.customExpiresAt.trim() || expiresAtFromDays(preset.ttlDays),
      maxIdleDays
    })
      .then((response) => {
        this.setData({ submitting: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "创建失败", icon: "none" });
          return;
        }
        const token = response.data.token;
        const apiUrl = getConfig().apiUrl;
        this.setData({
          createdToken: token,
          createdName: response.data.name,
          createdId: response.data.id,
          loginCommand: `ai-todo login --url ${apiUrl} --token ${token}`
        });
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  onCopyToken() {
    if (!this.data.createdToken) return;
    wx.setClipboardData({
      data: this.data.createdToken,
      success: () => wx.showToast({ title: "已复制", icon: "success" })
    });
  },

  onCopyCommand() {
    if (!this.data.loginCommand) return;
    wx.setClipboardData({
      data: this.data.loginCommand,
      success: () => wx.showToast({ title: "已复制", icon: "success" })
    });
  },

  onDone() {
    wx.navigateBack();
  }
});
