import { loadAccountDay } from "../../lib/account-day";
import { createCalendarEvent } from "../../lib/api";
import type { ContactSummary } from "../../lib/api";
import { applyDefaultEventEnd, loadContentPrefs } from "../../lib/content-prefs";
import { combineDateTime } from "../../lib/format";
import { todoPageThemeData } from "../../lib/theme";
import {
  loadWechatNotificationPrefs,
  requestCalendarEventNotification
} from "../../lib/wechat-notify";

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
    notifyEnabled: true,
    notifyAvailable: false,
    reminderTemplateId: "",
    selectedContact: null as ContactSummary | null,
    accountTimezone: "",
    submitting: false
  },

  _endTouched: false,

  onLoad() {
    Promise.all([loadAccountDay(), loadContentPrefs()]).then(([{ today, timezone, nowTime }, prefs]) => {
      const endDefaults = applyDefaultEventEnd(today, nowTime, {
        ...prefs.calendar,
        defaultHasEnd: true,
        defaultDurationMinutes: 60
      });
      this.setData({
        accountTimezone: timezone,
        startDate: today,
        startTime: nowTime,
        hasEnd: endDefaults.hasEnd,
        endDate: endDefaults.endDate,
        endTime: endDefaults.endTime
      });
    });
    loadWechatNotificationPrefs().then((prefs) => {
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

  onLocationInput(e: { detail: { value: string } }) {
    this.setData({ location: e.detail.value });
  },

  onDescriptionInput(e: { detail: { value: string } }) {
    this.setData({ description: e.detail.value });
  },

  toggleDescription() {
    this.setData({ descriptionExpanded: !this.data.descriptionExpanded });
  },

  onNotifyToggle(e: { detail: { value: boolean } }) {
    this.setData({ notifyEnabled: e.detail.value });
  },

  onEndToggle(e: { detail: { value: boolean } }) {
    const hasEnd = e.detail.value;
    if (hasEnd && !this._endTouched) {
      const endDefaults = applyDefaultEventEnd(this.data.startDate, this.data.startTime, {
        defaultHasEnd: true,
        defaultDurationMinutes: 60,
        selectTodayOnOpen: true
      });
      this.setData({
        hasEnd,
        endDate: endDefaults.endDate,
        endTime: endDefaults.endTime
      });
      return;
    }
    this.setData({ hasEnd });
  },

  onStartDateChange(e: { detail: { value: string } }) {
    this.setStartDateTime(e.detail.value, this.data.startTime);
  },

  onStartTimeChange(e: { detail: { value: string } }) {
    this.setStartDateTime(this.data.startDate, e.detail.value);
  },

  onEndDateChange(e: { detail: { value: string } }) {
    this._endTouched = true;
    this.setData({ endDate: e.detail.value });
  },

  onEndTimeChange(e: { detail: { value: string } }) {
    this._endTouched = true;
    this.setData({ endTime: e.detail.value });
  },

  setStartDateTime(startDate: string, startTime: string) {
    if (this._endTouched) {
      this.setData({ startDate, startTime });
      return;
    }
    const endDefaults = applyDefaultEventEnd(startDate, startTime, {
      defaultHasEnd: true,
      defaultDurationMinutes: 60,
      selectTodayOnOpen: true
    });
    this.setData({
      startDate,
      startTime,
      hasEnd: true,
      endDate: endDefaults.endDate,
      endTime: endDefaults.endTime
    });
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
      wechatNotifyRequested?: boolean;
      contactIds?: string[];
    } = {
      title,
      startAt: combineDateTime(
        this.data.startDate,
        this.data.startTime,
        this.data.accountTimezone || undefined
      ),
      wechatNotifyRequested: this.data.notifyAvailable && this.data.notifyEnabled
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
      .then(async (response) => {
        this.setData({ submitting: false });
        if (!response.ok) {
          wx.showToast({ title: response.error?.message || "创建失败", icon: "none" });
          return;
        }
        await this.notifyAfterSave(response.data?.calendarEvent.id);
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  async notifyAfterSave(eventId?: string) {
    const shouldNotify =
      Boolean(eventId) &&
      this.data.notifyEnabled &&
      this.data.notifyAvailable &&
      Boolean(this.data.reminderTemplateId);

    if (!shouldNotify || !eventId) {
      wx.showToast({ title: "已创建", icon: "success" });
      return;
    }

    try {
      const { accepted } = await requestCalendarEventNotification({
        eventId,
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
