import { loadAccountDay } from "../../lib/account-day";
import { fetchReminder, updateReminder } from "../../lib/api";
import type { ContactSummary } from "../../lib/api";
import { combineDateTime, splitIsoDateTime } from "../../lib/format";
import { todoPageThemeData } from "../../lib/theme";
import {
  loadReminderNotificationPrefs,
  requestReminderNotification
} from "../../lib/wechat-notify";

Page({
  data: {
    ...todoPageThemeData(),
    reminderId: "",
    loading: true,
    isCompleted: false,
    status: "pending" as "pending" | "in_progress" | "completed",
    title: "",
    notes: "",
    notesExpanded: false,
    sourceLabel: "",
    hasDue: true,
    dueDate: "",
    dueTime: "",
    notifyAvailable: false,
    reminderTemplateId: "",
    selectedContact: null as ContactSummary | null,
    accountTimezone: "",
    submitting: false
  },

  _originalDueAt: "",

  onLoad(options: { id?: string }) {
    const reminderId = (options.id || "").trim();
    if (!reminderId) {
      wx.showToast({ title: "缺少提醒 ID", icon: "none" });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ reminderId });
    Promise.all([loadAccountDay(), fetchReminder(reminderId), loadReminderNotificationPrefs()])
      .then(([account, response, prefs]) => {
        if (!response.ok || !response.data) {
          this.setData({ loading: false });
          wx.showToast({ title: response.error?.message || "加载失败", icon: "none" });
          return;
        }
        const reminder = response.data.reminder;
        const status = (reminder.status || "pending") as "pending" | "in_progress" | "completed";
        const isCompleted = status === "completed";
        const hasDue = Boolean(reminder.dueAt);
        const tz = account.timezone;
        const { date, time } = splitIsoDateTime(reminder.dueAt, tz);
        this._originalDueAt = reminder.dueAt || "";
        this.setData({
          loading: false,
          accountTimezone: tz,
          status,
          isCompleted,
          title: reminder.title || "",
          notes: reminder.notes || "",
          notesExpanded: Boolean(reminder.notes),
          sourceLabel: formatSourceLabel(reminder.source, reminder.externalId),
          hasDue: isCompleted ? false : hasDue,
          dueDate: date,
          dueTime: time,
          selectedContact: reminder.contacts?.[0] || null,
          notifyAvailable: prefs.notifyAvailable,
          reminderTemplateId: prefs.reminderTemplateId
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: "网络错误", icon: "none" });
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

  onStatusChange(e: { currentTarget: { dataset: { status: string } } }) {
    const status = e.currentTarget.dataset.status as "pending" | "in_progress" | "completed";
    if (!status || status === this.data.status) return;
    this.setData({
      status,
      isCompleted: status === "completed",
      hasDue: status === "completed" ? false : this.data.hasDue
    });
  },

  onSubmit() {
    const title = this.data.title.trim();
    if (!title) {
      wx.showToast({ title: "请输入标题", icon: "none" });
      return;
    }

    const payload: {
      title: string;
      notes: string;
      status: string;
      dueAt?: string | null;
      contactIds: string[];
    } = {
      title,
      notes: this.data.notes.trim(),
      status: this.data.status,
      contactIds: this.data.selectedContact ? [this.data.selectedContact.id] : []
    };

    let nextDueAt: string | null = null;
    if (!this.data.isCompleted) {
      nextDueAt = this.data.hasDue
        ? combineDateTime(
            this.data.dueDate,
            this.data.dueTime,
            this.data.accountTimezone || undefined
          )
        : null;
      payload.dueAt = nextDueAt;
    }

    const dueChanged = !this.data.isCompleted && nextDueAt !== this._originalDueAt;

    this.setData({ submitting: true });
    updateReminder(this.data.reminderId, payload)
      .then(async (response) => {
        this.setData({ submitting: false });
        if (!response.ok) {
          wx.showToast({ title: response.error?.message || "保存失败", icon: "none" });
          return;
        }
        if (dueChanged && nextDueAt && this.data.notifyAvailable && this.data.reminderTemplateId) {
          try {
            const { accepted } = await requestReminderNotification({
              reminderId: this.data.reminderId,
              templateId: this.data.reminderTemplateId,
              enabled: true
            });
            wx.showToast({
              title: accepted ? "已保存并更新微信提醒" : "已保存，未重新授权微信提醒",
              icon: accepted ? "success" : "none"
            });
          } catch {
            wx.showToast({ title: "已保存，提醒授权同步失败", icon: "none" });
          }
        } else {
          wx.showToast({ title: "已保存", icon: "success" });
        }
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});

function formatSourceLabel(source?: string, externalId?: string): string {
  if (!source || !externalId) {
    return "";
  }
  const sourceNames: Record<string, string> = {
    email: "邮件",
    wechat: "微信",
    wechat_message: "微信消息",
    work_order: "工单",
    ticket: "工单",
    tencent_doc: "腾讯文档",
    manual: "手动"
  };
  const name = sourceNames[source] || source;
  return `${name} · ${externalId}`;
}
