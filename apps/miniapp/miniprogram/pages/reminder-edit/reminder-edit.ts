import { fetchReminder, updateReminder } from "../../lib/api";
import type { ContactSummary } from "../../lib/api";
import { combineDateTime, splitIsoDateTime } from "../../lib/format";

Page({
  data: {
    reminderId: "",
    loading: true,
    isCompleted: false,
    title: "",
    notes: "",
    notesExpanded: false,
    hasDue: true,
    dueDate: "",
    dueTime: "",
    selectedContact: null as ContactSummary | null,
    submitting: false
  },

  onLoad(options: { id?: string }) {
    const reminderId = (options.id || "").trim();
    if (!reminderId) {
      wx.showToast({ title: "缺少提醒 ID", icon: "none" });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ reminderId });
    fetchReminder(reminderId)
      .then((response) => {
        if (!response.ok || !response.data) {
          this.setData({ loading: false });
          wx.showToast({ title: response.error?.message || "加载失败", icon: "none" });
          return;
        }
        const reminder = response.data.reminder;
        const isCompleted = reminder.status === "completed";
        const hasDue = Boolean(reminder.dueAt);
        const { date, time } = splitIsoDateTime(reminder.dueAt);
        this.setData({
          loading: false,
          isCompleted,
          title: reminder.title || "",
          notes: reminder.notes || "",
          notesExpanded: Boolean(reminder.notes),
          hasDue: isCompleted ? false : hasDue,
          dueDate: date,
          dueTime: time,
          selectedContact: reminder.contacts?.[0] || null
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

  onSubmit() {
    const title = this.data.title.trim();
    if (!title) {
      wx.showToast({ title: "请输入标题", icon: "none" });
      return;
    }

    const payload: {
      title: string;
      notes: string;
      dueAt?: string | null;
      contactIds: string[];
    } = {
      title,
      notes: this.data.notes.trim(),
      contactIds: this.data.selectedContact ? [this.data.selectedContact.id] : []
    };

    if (!this.data.isCompleted) {
      payload.dueAt = this.data.hasDue
        ? combineDateTime(this.data.dueDate, this.data.dueTime)
        : null;
    }

    this.setData({ submitting: true });
    updateReminder(this.data.reminderId, payload)
      .then((response) => {
        this.setData({ submitting: false });
        if (!response.ok) {
          wx.showToast({ title: response.error?.message || "保存失败", icon: "none" });
          return;
        }
        wx.showToast({ title: "已保存", icon: "success" });
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
