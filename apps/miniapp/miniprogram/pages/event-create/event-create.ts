import { loadAccountDay } from "../../lib/account-day";
import { createCalendarEvent } from "../../lib/api";
import type { ContactSummary } from "../../lib/api";
import { applyDefaultEventEnd, loadContentPrefs } from "../../lib/content-prefs";
import { combineDateTime } from "../../lib/format";
import { todoPageThemeData } from "../../lib/theme";

Page({
  data: {
    ...todoPageThemeData(),
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
    accountTimezone: "",
    submitting: false
  },

  onLoad() {
    Promise.all([loadAccountDay(), loadContentPrefs()]).then(([{ today, timezone, nowTime }, prefs]) => {
      const endDefaults = applyDefaultEventEnd(today, nowTime, prefs.calendar);
      this.setData({
        accountTimezone: timezone,
        startDate: today,
        startTime: nowTime,
        hasEnd: endDefaults.hasEnd,
        endDate: endDefaults.endDate,
        endTime: endDefaults.endTime
      });
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
      endAt?: string;
      location?: string;
      description?: string;
      contactIds?: string[];
    } = {
      title,
      startAt: combineDateTime(
        this.data.startDate,
        this.data.startTime,
        this.data.accountTimezone || undefined
      )
    };

    if (this.data.hasEnd) {
      payload.endAt = combineDateTime(
        this.data.endDate,
        this.data.endTime,
        this.data.accountTimezone || undefined
      );
    }

    const location = this.data.location.trim();
    if (location) {
      payload.location = location;
    }

    const description = this.data.description.trim();
    if (description) {
      payload.description = description;
    }

    if (this.data.selectedContact) {
      payload.contactIds = [this.data.selectedContact.id];
    }

    this.setData({ submitting: true });
    createCalendarEvent(payload)
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
