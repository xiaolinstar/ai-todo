import { loadAccountDay } from "../../lib/account-day";
import { fetchCalendarEvent, updateCalendarEvent } from "../../lib/api";
import type { ContactSummary } from "../../lib/api";
import { combineDateTime, splitIsoDateTime } from "../../lib/format";
import { applyDefaultEventEnd } from "../../lib/content-prefs";
import { todoPageThemeData } from "../../lib/theme";
import {
  loadWechatNotificationPrefs,
  requestCalendarEventNotification
} from "../../lib/wechat-notify";

Page({
  data: {
    ...todoPageThemeData(),
    eventId: "",
    loading: true,
    title: "",
    titleTextareaHeight: titleTextareaHeight(""),
    location: "",
    description: "",
    descriptionExpanded: false,
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    hasEnd: false,
    notifyAvailable: false,
    reminderTemplateId: "",
    selectedContacts: [] as ContactSummary[],
    contactLabel: "选择",
    accountTimezone: "",
    submitting: false
  },

  _originalStartAt: "",
  _endTouched: false,
  _originalDurationMinutes: 60,

  onLoad(options: { id?: string }) {
    const eventId = (options.id || "").trim();
    if (!eventId) {
      wx.showToast({ title: "缺少日程 ID", icon: "none" });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ eventId });
    Promise.all([loadAccountDay(), fetchCalendarEvent(eventId), loadWechatNotificationPrefs()])
      .then(([account, response, prefs]) => {
        if (!response.ok || !response.data) {
          this.setData({ loading: false });
          wx.showToast({ title: response.error?.message || "加载失败", icon: "none" });
          return;
        }
        const event = response.data.calendarEvent;
        const tz = account.timezone;
        const start = splitIsoDateTime(event.startAt, tz);
        const end = splitIsoDateTime(event.endAt, tz);
        this._originalStartAt = event.startAt;
        this._endTouched = false;
        this._originalDurationMinutes = event.endAt
          ? Math.max(
              1,
              Math.round(
                (new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60000
              )
            )
          : 60;
        this.setData({
          loading: false,
          accountTimezone: tz,
          notifyAvailable: prefs.notifyAvailable,
          reminderTemplateId: prefs.reminderTemplateId,
          title: event.title || "",
          titleTextareaHeight: titleTextareaHeight(event.title || ""),
          location: event.location || "",
          description: event.description || "",
          descriptionExpanded: Boolean(event.description),
          startDate: start.date,
          startTime: start.time,
          endDate: end.date,
          endTime: end.time,
          hasEnd: Boolean(event.endAt),
          selectedContacts: event.contacts || [],
          contactLabel: formatContactLabel(event.contacts || [])
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  onTitleInput(e: { detail: { value: string } }) {
    this.setData({
      title: e.detail.value,
      titleTextareaHeight: titleTextareaHeight(e.detail.value)
    });
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
    const hasEnd = e.detail.value;
    if (hasEnd && !this._endTouched) {
      const endDefaults = applyDefaultEventEnd(this.data.startDate, this.data.startTime, {
        defaultHasEnd: true,
        defaultDurationMinutes: this.normalizeDuration(this._originalDurationMinutes),
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

  normalizeDuration(minutes: number): 30 | 60 | 90 {
    if (minutes === 30 || minutes === 90) {
      return minutes;
    }
    return 60;
  },

  setStartDateTime(startDate: string, startTime: string) {
    if (this._endTouched || !this.data.hasEnd) {
      this.setData({ startDate, startTime });
      return;
    }
    const endDefaults = applyDefaultEventEnd(startDate, startTime, {
      defaultHasEnd: true,
      defaultDurationMinutes: this.normalizeDuration(this._originalDurationMinutes),
      selectTodayOnOpen: true
    });
    this.setData({
      startDate,
      startTime,
      endDate: endDefaults.endDate,
      endTime: endDefaults.endTime
    });
  },

  pickContact() {
    wx.navigateTo({
      url: "/pages/contact-picker/contact-picker",
      events: {
        selectContact: (data: unknown) => {
          const contacts = [data as ContactSummary];
          this.setData({
            selectedContacts: contacts,
            contactLabel: formatContactLabel(contacts)
          });
        }
      }
    });
  },

  clearContact() {
    this.setData({
      selectedContacts: [],
      contactLabel: formatContactLabel([])
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
      startAt: string;
      endAt: string | null;
      location: string;
      description: string;
      contactIds: string[];
    } = {
      title,
      startAt: combineDateTime(
        this.data.startDate,
        this.data.startTime,
        this.data.accountTimezone || undefined
      ),
      endAt: this.data.hasEnd
        ? combineDateTime(
            this.data.endDate,
            this.data.endTime,
            this.data.accountTimezone || undefined
          )
        : null,
      location: this.data.location.trim(),
      description: this.data.description.trim(),
      contactIds: this.data.selectedContacts.map((contact: ContactSummary) => contact.id)
    };

    const nextStartAt = payload.startAt;
    const startChanged = nextStartAt !== this._originalStartAt;

    this.setData({ submitting: true });
    updateCalendarEvent(this.data.eventId, payload)
      .then(async (response) => {
        this.setData({ submitting: false });
        if (!response.ok) {
          wx.showToast({ title: response.error?.message || "保存失败", icon: "none" });
          return;
        }
        if (startChanged && this.data.notifyAvailable && this.data.reminderTemplateId) {
          try {
            const { accepted } = await requestCalendarEventNotification({
              eventId: this.data.eventId,
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

function formatContactLabel(contacts: ContactSummary[]): string {
  if (contacts.length === 0) {
    return "选择";
  }
  if (contacts.length === 1) {
    return contacts[0].displayName;
  }
  const names = contacts.slice(0, 2).map((contact) => contact.displayName).join("、");
  return `${names}等 ${contacts.length} 人`;
}

function titleTextareaHeight(title: string): number {
  const lines = Math.min(5, Math.max(2, Math.ceil(title.trim().length / 18)));
  return 32 + lines * 45;
}
