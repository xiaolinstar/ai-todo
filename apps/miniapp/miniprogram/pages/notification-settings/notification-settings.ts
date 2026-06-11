import { fetchNotificationSettings, updateNotificationSettings } from "../../lib/api";
import { formatQuietHoursLabel } from "../../lib/notification-labels";
import { todoPageThemeData } from "../../lib/theme";

Page({
  data: {
    ...todoPageThemeData(),
    loading: true,
    saving: false,
    wechatEnabled: false,
    quietStart: "",
    quietEnd: "",
    quietHoursLabel: "未设置",
    templateConfigured: true
  },

  onShow() {
    this.loadSettings();
  },

  loadSettings() {
    this.setData({ loading: true });
    fetchNotificationSettings()
      .then((settingsResponse) => {
        this.setData({ loading: false });
        if (!settingsResponse.ok || !settingsResponse.data) {
          wx.showToast({ title: settingsResponse.error?.message || "加载失败", icon: "none" });
          setTimeout(() => wx.navigateBack(), 600);
          return;
        }
        const settings = settingsResponse.data.settings;
        const quietStart = settings.quietStart || "";
        const quietEnd = settings.quietEnd || "";
        const wechatEnabled = settings.wechatEnabled && settings.defaultReminderEnabled;
        this.setData({
          wechatEnabled,
          quietStart,
          quietEnd,
          quietHoursLabel: formatQuietHoursLabel(quietStart, quietEnd),
          templateConfigured: Boolean(settings.wechatReminderTemplateId)
        });
        if (settings.wechatEnabled !== wechatEnabled || settings.defaultReminderEnabled !== wechatEnabled) {
          this.syncWechatReminder(wechatEnabled, { silent: true });
        }
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  syncWechatReminder(wechatEnabled: boolean, options?: { silent?: boolean }) {
    this.setData({ saving: true });
    updateNotificationSettings({
      wechatEnabled,
      defaultReminderEnabled: wechatEnabled
    })
      .then((response) => {
        this.setData({ saving: false });
        if (!response.ok || !response.data) {
          if (!options?.silent) {
            wx.showToast({ title: response.error?.message || "保存失败", icon: "none" });
          }
          this.loadSettings();
          return;
        }
        const settings = response.data.settings;
        const quietStart = settings.quietStart || "";
        const quietEnd = settings.quietEnd || "";
        this.setData({
          wechatEnabled: settings.wechatEnabled && settings.defaultReminderEnabled,
          quietStart,
          quietEnd,
          quietHoursLabel: formatQuietHoursLabel(quietStart, quietEnd),
          templateConfigured: Boolean(settings.wechatReminderTemplateId)
        });
        if (!options?.silent) {
          wx.showToast({ title: "已保存", icon: "success" });
        }
      })
      .catch(() => {
        this.setData({ saving: false });
        if (!options?.silent) {
          wx.showToast({ title: "网络错误", icon: "none" });
        }
        this.loadSettings();
      });
  },

  onWechatEnabledChange(e: { detail: { value: boolean } }) {
    this.syncWechatReminder(e.detail.value);
  },

  onOpenQuietHours() {
    wx.navigateTo({ url: "/pages/notification-quiet-hours/notification-quiet-hours" });
  },

  onOpenDelivery() {
    wx.navigateTo({ url: "/pages/notification-delivery/notification-delivery" });
  }
});
