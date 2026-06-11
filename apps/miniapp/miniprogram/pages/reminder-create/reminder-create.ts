import { loadAccountDay } from "../../lib/account-day";
import { createReminder } from "../../lib/api";
import type { ContactSummary } from "../../lib/api";
import { combineDateTime } from "../../lib/format";
import { todoPageThemeData } from "../../lib/theme";
import {
  loadReminderNotificationPrefs,
  requestReminderNotification
} from "../../lib/wechat-notify";

Page({
  data: {
    ...todoPageThemeData(),
    title: "",
    notes: "",
    notesExpanded: false,
    hasDue: false,
    dueDate: "",
    dueTime: "",
    notifyEnabled: true,
    notifyAvailable: false,
    reminderTemplateId: "",
    selectedContact: null as ContactSummary | null,
    accountTimezone: "",
    submitting: false
  },

  onLoad() {
    loadAccountDay().then(({ today, timezone, nowTime }) => {
      this.setData({
        accountTimezone: timezone,
        dueDate: today,
        dueTime: nowTime
      });
    });
    loadReminderNotificationPrefs().then((prefs) => {
      this.setData({
        notifyAvailable: prefs.notifyAvailable,
        notifyEnabled: prefs.notifyEnabled,
        reminderTemplateId: prefs.reminderTemplateId
      });
    });
  },

  onTitleInput(e: { detail: { value: string } }) {
    this.setData({ title: e.detail.value });
  },

  onNotesInput(e: { detail: { value: string } }) {
    this.setData({ notes: e.detail.value });
  },

  toggleNotes() {
    this.setData({ notesExpanded: !this.data.notesExpanded });
  },

  onDueToggle(e: { detail: { value: boolean } }) {
    this.setData({ hasDue: e.detail.value });
  },

  onDateChange(e: { detail: { value: string } }) {
    this.setData({ dueDate: e.detail.value });
  },

  onTimeChange(e: { detail: { value: string } }) {
    this.setData({ dueTime: e.detail.value });
  },

  onNotifyToggle(e: { detail: { value: boolean } }) {
    this.setData({ notifyEnabled: e.detail.value });
  },

  pickContact() {
    wx.navigateTo({
      url: "/pages/contact-picker/contact-picker",
      events: {
        selectContact: (data: unknown) => {
          this.setData({ selectedContact: data as ContactSummary });
        }
      }
    });
  },

  clearContact() {
    this.setData({ selectedContact: null });
  },

  onSubmit() {
    const title = this.data.title.trim();
    if (!title) {
      wx.showToast({ title: "请输入标题", icon: "none" });
      return;
    }

    const payload: { title: string; notes?: string; dueAt?: string; contactIds?: string[] } = {
      title
    };
    const notes = this.data.notes.trim();
    if (notes) {
      payload.notes = notes;
    }
    if (this.data.hasDue) {
      payload.dueAt = combineDateTime(
        this.data.dueDate,
        this.data.dueTime,
        this.data.accountTimezone || undefined
      );
    }
    if (this.data.selectedContact) {
      payload.contactIds = [this.data.selectedContact.id];
    }

    this.setData({ submitting: true });
    createReminder(payload)
      .then(async (response) => {
        this.setData({ submitting: false });
        if (!response.ok) {
          wx.showToast({ title: response.error?.message || "创建失败", icon: "none" });
          return;
        }
        await this.notifyAfterSave(response.data?.reminder.id);
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  async notifyAfterSave(reminderId?: string) {
    const shouldNotify =
      Boolean(reminderId) &&
      this.data.hasDue &&
      this.data.notifyEnabled &&
      this.data.notifyAvailable &&
      Boolean(this.data.reminderTemplateId);

    if (!shouldNotify || !reminderId) {
      wx.showToast({ title: "已创建", icon: "success" });
      return;
    }

    try {
      const { accepted } = await requestReminderNotification({
        reminderId,
        templateId: this.data.reminderTemplateId,
        enabled: true
      });
      wx.showToast({
        title: accepted ? "已创建并开启提醒" : "已创建，未开启微信提醒",
        icon: accepted ? "success" : "none"
      });
    } catch {
      wx.showToast({ title: "已创建，提醒授权同步失败", icon: "none" });
    }
  }
});
