import { createReminder, type ContactSummary } from "../../lib/api";
import { combineDateTime, nowIsoTime, todayIsoDate } from "../../lib/format";

Page({
  data: {
    title: "",
    hasDue: true,
    dueDate: "",
    dueTime: "",
    selectedContact: null as ContactSummary | null,
    submitting: false
  },

  onLoad() {
    this.setData({
      dueDate: todayIsoDate(),
      dueTime: nowIsoTime()
    });
  },

  onTitleInput(e: { detail: { value: string } }) {
    this.setData({ title: e.detail.value });
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
        selectContact: (contact: ContactSummary) => {
          this.setData({ selectedContact: contact });
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

    const payload: { title: string; dueAt?: string; contactIds?: string[] } = { title };
    if (this.data.hasDue) {
      payload.dueAt = combineDateTime(this.data.dueDate, this.data.dueTime);
    }
    if (this.data.selectedContact) {
      payload.contactIds = [this.data.selectedContact.id];
    }

    this.setData({ submitting: true });
    createReminder(payload)
      .then((response) => {
        this.setData({ submitting: false });
        if (!response.ok) {
          wx.showToast({ title: response.error?.message || "创建失败", icon: "none" });
          return;
        }
        wx.showToast({ title: "已创建", icon: "success" });
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
