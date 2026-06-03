import { fetchCalendarEvent, updateCalendarEvent } from "../../lib/api";
import type { ContactSummary } from "../../lib/api";
import { combineDateTime, splitIsoDateTime } from "../../lib/format";
import { todoPageThemeData } from "../../lib/theme";

Page({
  data: {
    ...todoPageThemeData(),
    eventId: "",
    loading: true,
    title: "",
    location: "",
    description: "",
    descriptionExpanded: false,
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    hasEnd: false,
    selectedContact: null as ContactSummary | null,
    submitting: false
  },

  onLoad(options: { id?: string }) {
    const eventId = (options.id || "").trim();
    if (!eventId) {
      wx.showToast({ title: "缺少日程 ID", icon: "none" });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ eventId });
    fetchCalendarEvent(eventId)
      .then((response) => {
        if (!response.ok || !response.data) {
          this.setData({ loading: false });
          wx.showToast({ title: response.error?.message || "加载失败", icon: "none" });
          return;
        }
        const event = response.data.calendarEvent;
        const start = splitIsoDateTime(event.startAt);
        const end = splitIsoDateTime(event.endAt);
        this.setData({
          loading: false,
          title: event.title || "",
          location: event.location || "",
          description: event.description || "",
          descriptionExpanded: Boolean(event.description),
          startDate: start.date,
          startTime: start.time,
          endDate: end.date,
          endTime: end.time,
          hasEnd: Boolean(event.endAt),
          selectedContact: event.contacts?.[0] || null
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

  onLocationInput(e: { detail: { value: string } }) {
    this.setData({ location: e.detail.value });
  },

  onDescriptionInput(e: { detail: { value: string } }) {
    this.setData({ description: e.detail.value });
  },

  toggleDescription() {
    this.setData({ descriptionExpanded: !this.data.descriptionExpanded });
  },

  onEndToggle(e: { detail: { value: boolean } }) {
    this.setData({ hasEnd: e.detail.value });
  },

  onStartDateChange(e: { detail: { value: string } }) {
    this.setData({ startDate: e.detail.value });
  },

  onStartTimeChange(e: { detail: { value: string } }) {
    this.setData({ startTime: e.detail.value });
  },

  onEndDateChange(e: { detail: { value: string } }) {
    this.setData({ endDate: e.detail.value });
  },

  onEndTimeChange(e: { detail: { value: string } }) {
    this.setData({ endTime: e.detail.value });
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
      startAt: string;
      endAt: string | null;
      location: string;
      description: string;
      contactIds: string[];
    } = {
      title,
      startAt: combineDateTime(this.data.startDate, this.data.startTime),
      endAt: this.data.hasEnd ? combineDateTime(this.data.endDate, this.data.endTime) : null,
      location: this.data.location.trim(),
      description: this.data.description.trim(),
      contactIds: this.data.selectedContact ? [this.data.selectedContact.id] : []
    };

    this.setData({ submitting: true });
    updateCalendarEvent(this.data.eventId, payload)
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
