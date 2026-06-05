import { createPat } from "../../lib/api";
import { getConfig } from "../../lib/config";
import {
  TOKEN_PRESETS,
  buildLoginCommand,
  defaultTokenName,
  expiresAtFromDays,
  findTokenPreset
} from "../../lib/token-presets";

interface CreatedTokenPayload {
  token: string;
  name: string;
  tokenHint: string;
  loginCommand: string;
}

Page({
  data: {
    presets: TOKEN_PRESETS,
    selectedPreset: "daily",
    selectedPresetLabel: findTokenPreset("daily").description,
    name: defaultTokenName(),
    submitting: false,
    createdToken: "",
    createdName: "",
    createdTokenHint: "",
    loginCommand: ""
  },

  onLoad(query: { preset?: string; name?: string }) {
    const preset = findTokenPreset(query.preset || "daily");
    const name = query.name ? decodeURIComponent(query.name) : defaultTokenName();
    this.setData({
      selectedPreset: preset.id,
      selectedPresetLabel: preset.description,
      name
    });

    const eventChannel = this.getOpenerEventChannel?.();
    if (eventChannel && typeof eventChannel.on === "function") {
      eventChannel.on("created", (payload: CreatedTokenPayload) => {
        this.applyCreatedResult(payload);
      });
    }
  },

  applyCreatedResult(payload: CreatedTokenPayload) {
    this.setData({
      createdToken: payload.token,
      createdName: payload.name,
      createdTokenHint: payload.tokenHint,
      loginCommand: payload.loginCommand
    });
    wx.setClipboardData({
      data: payload.loginCommand,
      success: () => wx.showToast({ title: "已复制登录命令", icon: "success" })
    });
  },

  onNameInput(e: { detail: { value: string } }) {
    this.setData({ name: e.detail.value });
  },

  onPresetTap(e: { currentTarget: { dataset: { id: string } } }) {
    const preset = findTokenPreset(e.currentTarget.dataset.id);
    this.setData({
      selectedPreset: preset.id,
      selectedPresetLabel: preset.description
    });
  },

  onCreate() {
    if (this.data.submitting) return;
    const name = this.data.name.trim();
    if (!name) {
      wx.showToast({ title: "请输入令牌名称", icon: "none" });
      return;
    }

    const preset = findTokenPreset(this.data.selectedPreset);
    this.setData({ submitting: true });
    createPat({
      name,
      expiresAt: expiresAtFromDays(preset.ttlDays),
      maxIdleDays: preset.maxIdleDays
    })
      .then((response) => {
        this.setData({ submitting: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "创建失败", icon: "none" });
          return;
        }
        const token = response.data.token;
        const apiUrl = getConfig().apiUrl;
        this.applyCreatedResult({
          token,
          name: response.data.name,
          tokenHint: response.data.tokenHint || `aitodo_****${token.slice(-4)}`,
          loginCommand: buildLoginCommand(apiUrl, token)
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
