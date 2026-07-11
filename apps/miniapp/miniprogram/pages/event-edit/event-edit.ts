import { handleApiError } from '../../lib/error-handler';
import { loadAccountDay } from '../../lib/account-day';
import { fetchCalendarEvent, updateCalendarEvent } from '../../lib/api';
import type { ContactSummary } from '../../lib/api';
import { combineDateTime, splitIsoDateTime } from '../../lib/format';
import { applyDefaultEventEnd } from '../../lib/content-prefs';
import { todoPageThemeData } from '../../lib/theme';
import { loadWechatNotificationPrefs, enableWechatNotifyForTarget } from '../../lib/wechat-notify';

Page({
  data: {
    ...todoPageThemeData(),
    eventId: '',
    loading: true,
    title: '',
    titleTextareaHeight: titleTextareaHeight(''),
    location: '',
    description: '',
    descriptionExpanded: false,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    hasEnd: false,
    notifyAvailable: false,
    notifyEnabled: false,
    reminderTemplateId: '',
    selectedContacts: [] as ContactSummary[],
    contactLabel: '选择',
    accountTimezone: '',
    submitting: false,
  },

  _originalStartAt: '',
  _endTouched: false,
  _originalDurationMinutes: 60,
  _autoSubscribe: false,

  onLoad(options: { id?: string; subscribe?: string }) {
    const eventId = (options.id || '').trim();
    const autoSubscribe = (options.subscribe || '').trim() === '1';
    if (!eventId) {
      wx.showToast({ title: '缺少日程 ID', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ eventId });
    this._autoSubscribe = autoSubscribe;
    Promise.all([loadAccountDay(), fetchCalendarEvent(eventId), loadWechatNotificationPrefs()])
      .then(([account, response, prefs]) => {
        if (!response.ok || !response.data) {
          this.setData({ loading: false });
          handleApiError(response.error, '加载失败');
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
                (new Date(event.endAt).getTime() - new Date(event.startAt).getTime()) / 60000,
              ),
            )
          : 60;
        this.setData({
          loading: false,
          accountTimezone: tz,
          notifyAvailable: prefs.notifyAvailable,
          notifyEnabled: Boolean(event.wechatNotifyRequested),
          reminderTemplateId: prefs.reminderTemplateId,
          title: event.title || '',
          titleTextareaHeight: titleTextareaHeight(event.title || ''),
          location: event.location || '',
          description: event.description || '',
          descriptionExpanded: Boolean(event.description),
          startDate: start.date,
          startTime: start.time,
          endDate: end.date,
          endTime: end.time,
          hasEnd: Boolean(event.endAt),
          selectedContacts: event.contacts || [],
          contactLabel: formatContactLabel(event.contacts || []),
        });
        if (this._autoSubscribe && prefs.notifyAvailable && prefs.reminderTemplateId) {
          this.setData({ notifyEnabled: true });
          updateCalendarEvent(eventId, { wechatNotifyRequested: true })
            .then(() =>
              enableWechatNotifyForTarget({
                targetType: 'calendar_event',
                targetId: eventId,
                templateId: prefs.reminderTemplateId,
              }),
            )
            .then(({ accepted }) => {
              wx.showToast({
                title: accepted ? '已开启微信提醒' : '未授权微信提醒',
                icon: accepted ? 'success' : 'none',
              });
            })
            .catch(() => {
              wx.showToast({ title: '提醒授权失败', icon: 'none' });
            });
        }
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  onTitleInput(e: { detail: { value: string } }) {
    this.setData({
      title: e.detail.value,
      titleTextareaHeight: titleTextareaHeight(e.detail.value),
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

  onNotifyToggle(e: { detail: { value: boolean } }) {
    this.setData({ notifyEnabled: e.detail.value });
  },

  onEndToggle(e: { detail: { value: boolean } }) {
    const hasEnd = e.detail.value;
    if (hasEnd && !this._endTouched) {
      const endDefaults = applyDefaultEventEnd(
        this.data.startDate,
        this.data.startTime,
        this._originalDurationMinutes,
        this.data.accountTimezone,
      );
      this.setData({
        hasEnd,
        endDate: endDefaults.endDate,
        endTime: endDefaults.endTime,
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
    if (this._endTouched || !this.data.hasEnd) {
      this.setData({ startDate, startTime });
      return;
    }
    const endDefaults = applyDefaultEventEnd(
      startDate,
      startTime,
      this._originalDurationMinutes,
      this.data.accountTimezone,
    );
    this.setData({
      startDate,
      startTime,
      endDate: endDefaults.endDate,
      endTime: endDefaults.endTime,
    });
  },

  pickContact() {
    wx.navigateTo({
      url: '/pages/contact-picker/contact-picker',
      events: {
        selectContact: (data: unknown) => {
          const contacts = [data as ContactSummary];
          this.setData({
            selectedContacts: contacts,
            contactLabel: formatContactLabel(contacts),
          });
        },
      },
    });
  },

  clearContact() {
    this.setData({
      selectedContacts: [],
      contactLabel: formatContactLabel([]),
    });
  },

  onSubmit() {
    const title = this.data.title.trim();
    if (!title) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }

    const payload: {
      title: string;
      startAt: string;
      endAt: string | null;
      location: string;
      description: string;
      wechatNotifyRequested: boolean;
      contactIds: string[];
    } = {
      title,
      startAt: combineDateTime(
        this.data.startDate,
        this.data.startTime,
        this.data.accountTimezone || undefined,
      ),
      endAt: this.data.hasEnd
        ? combineDateTime(
            this.data.endDate,
            this.data.endTime,
            this.data.accountTimezone || undefined,
          )
        : null,
      location: this.data.location.trim(),
      description: this.data.description.trim(),
      wechatNotifyRequested: this.data.notifyEnabled,
      contactIds: this.data.selectedContacts.map((contact: ContactSummary) => contact.id),
    };

    const shouldSubscribe =
      this.data.notifyEnabled && this.data.notifyAvailable && Boolean(this.data.reminderTemplateId);

    this.setData({ submitting: true });
    updateCalendarEvent(this.data.eventId, payload)
      .then(async (response) => {
        this.setData({ submitting: false });
        if (!response.ok) {
          handleApiError(response.error, '保存失败');
          return;
        }
        if (shouldSubscribe) {
          try {
            const { accepted } = await enableWechatNotifyForTarget({
              targetType: 'calendar_event',
              targetId: this.data.eventId,
              templateId: this.data.reminderTemplateId,
            });
            wx.showToast({
              title: accepted ? '已保存并更新微信提醒' : '已保存，未重新授权微信提醒',
              icon: accepted ? 'success' : 'none',
            });
          } catch {
            wx.showToast({ title: '已保存，提醒授权同步失败', icon: 'none' });
          }
        } else {
          wx.showToast({ title: '已保存', icon: 'success' });
        }
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },
});

function formatContactLabel(contacts: ContactSummary[]): string {
  if (contacts.length === 0) {
    return '选择';
  }
  if (contacts.length === 1) {
    return contacts[0].displayName;
  }
  const names = contacts
    .slice(0, 2)
    .map((contact) => contact.displayName)
    .join('、');
  return `${names}等 ${contacts.length} 人`;
}

function titleTextareaHeight(title: string): number {
  const lines = Math.min(5, Math.max(2, Math.ceil(title.trim().length / 18)));
  return 32 + lines * 45;
}
