import { fetchNotificationSettings, updateNotificationSettings } from "../../lib/api";

Page({
  data: {
    loading: true,
    saving: false,
    wechatEnabled: false,
    defaultReminderEnabled: false,
    quietHoursText: "",
    templateConfigured: true
  },

  onShow() {
    this.loadSettings();
  },

  loadSettings() {
    this.setData({ loading: true });
    fetchNotificationSettings()
      .then((response) => {
        this.setData({ loading: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "加载失败", icon: "none" });
          setTimeout(() => wx.navigateBack(), 600);
          return;
        }
        const settings = response.data.settings;
        this.setData({
          wechatEnabled: settings.wechatEnabled,
          defaultReminderEnabled: settings.defaultReminderEnabled,
          templateConfigured: Boolean(settings.wechatReminderTemplateId),
          quietHoursText: this.formatQuietHours(settings.quietStart, settings.quietEnd)
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  formatQuietHours(start?: string, end?: string): string {
    if (!start && !end) return "";
    if (start && end) return `${start} – ${end}`;
    return start || end || "";
  },

  saveSettings(patch: { wechatEnabled?: boolean; defaultReminderEnabled?: boolean }) {
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
          defaultReminderEnabled: settings.defaultReminderEnabled,
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
    const patch: { wechatEnabled: boolean; defaultReminderEnabled?: boolean } = {
      wechatEnabled
    };
    if (!wechatEnabled) {
      patch.defaultReminderEnabled = false;
    }
    this.saveSettings(patch);
  },

  onDefaultReminderChange(e: { detail: { value: boolean } }) {
    this.saveSettings({ defaultReminderEnabled: e.detail.value });
  }
});
