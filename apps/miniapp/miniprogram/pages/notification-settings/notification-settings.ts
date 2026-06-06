import {
  fetchNotificationSettings,
  fetchNotificationStatus,
  updateNotificationSettings
} from "../../lib/api";
import { todoPageThemeData } from "../../lib/theme";

interface StatusRow {
  id: string;
  title: string;
  meta: string;
  statusClass: string;
}

Page({
  data: {
    ...todoPageThemeData(),
    loading: true,
    saving: false,
    wechatEnabled: false,
    quietStart: "",
    quietEnd: "",
    templateConfigured: true,
    statusItems: [] as StatusRow[]
  },

  onShow() {
    this.loadSettings();
  },

  loadSettings() {
    this.setData({ loading: true });
    Promise.all([fetchNotificationSettings(), fetchNotificationStatus(10)])
      .then(([settingsResponse, statusResponse]) => {
        this.setData({ loading: false });
        if (!settingsResponse.ok || !settingsResponse.data) {
          wx.showToast({ title: settingsResponse.error?.message || "加载失败", icon: "none" });
          setTimeout(() => wx.navigateBack(), 600);
          return;
        }
        const settings = settingsResponse.data.settings;
        const statusItems = this.mapStatusItems(statusResponse.data?.items ?? []);
        this.setData({
          wechatEnabled: settings.wechatEnabled,
          quietStart: settings.quietStart || "",
          quietEnd: settings.quietEnd || "",
          templateConfigured: Boolean(settings.wechatReminderTemplateId),
          statusItems
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  mapStatusItems(
    items: Array<{
      id: string;
      targetType: string;
      targetId: string;
      status: string;
      scheduledAt: string;
    }>
  ): StatusRow[] {
    return items.map((item) => {
      const shortId = item.targetId.length > 8 ? `${item.targetId.slice(0, 8)}…` : item.targetId;
      const typeLabel =
        item.targetType === "calendar_event"
          ? "日程"
          : item.targetType === "reminder"
            ? "提醒"
            : item.targetType;
      const statusClass =
        item.status === "failed" || item.status === "no_quota" ? "danger" : "muted";
      return {
        id: item.id,
        title: `${typeLabel} · ${shortId}`,
        meta: `${item.status} · ${item.scheduledAt}`,
        statusClass
      };
    });
  },

  saveSettings(patch: {
    wechatEnabled?: boolean;
    quietStart?: string | null;
    quietEnd?: string | null;
  }) {
    this.setData({ saving: true });
    updateNotificationSettings(patch)
      .then((response) => {
        this.setData({ saving: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "保存失败", icon: "none" });
          this.loadSettings();
          return;
        }
        const settings = response.data.settings;
        this.setData({
          wechatEnabled: settings.wechatEnabled,
          quietStart: settings.quietStart || "",
          quietEnd: settings.quietEnd || "",
          templateConfigured: Boolean(settings.wechatReminderTemplateId)
        });
        wx.showToast({ title: "已保存", icon: "success" });
      })
      .catch(() => {
        this.setData({ saving: false });
        wx.showToast({ title: "网络错误", icon: "none" });
        this.loadSettings();
      });
  },

  onWechatEnabledChange(e: { detail: { value: boolean } }) {
    const wechatEnabled = e.detail.value;
    const patch: {
      wechatEnabled: boolean;
      defaultReminderEnabled?: boolean;
    } = { wechatEnabled };
    if (!wechatEnabled) {
      patch.defaultReminderEnabled = false;
    }
    this.setData({ saving: true });
    updateNotificationSettings(patch)
      .then((response) => {
        this.setData({ saving: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "保存失败", icon: "none" });
          this.loadSettings();
          return;
        }
        const settings = response.data.settings;
        this.setData({
          wechatEnabled: settings.wechatEnabled,
          quietStart: settings.quietStart || "",
          quietEnd: settings.quietEnd || ""
        });
        wx.showToast({ title: "已保存", icon: "success" });
      })
      .catch(() => {
        this.setData({ saving: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  onQuietStartChange(e: { detail: { value: string } }) {
    const quietStart = e.detail.value || null;
    this.setData({ quietStart: quietStart || "" });
    this.saveSettings({ quietStart });
  },

  onQuietEndChange(e: { detail: { value: string } }) {
    const quietEnd = e.detail.value || null;
    this.setData({ quietEnd: quietEnd || "" });
    this.saveSettings({ quietEnd });
  }
});
