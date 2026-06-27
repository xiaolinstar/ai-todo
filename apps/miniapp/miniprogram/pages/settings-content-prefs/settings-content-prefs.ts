import {
  loadContentPrefs,
  saveContentPrefs,
  type CalendarContentPrefs,
  type ContactsContentPrefs,
} from '../../lib/content-prefs';
import { todoPageThemeData } from '../../lib/theme';

const DURATION_MINUTES = [30, 60, 90] as const;
const DURATION_LABELS = ['30 分钟', '60 分钟', '90 分钟'];
const SORT_LABELS = ['按姓名', '按列表顺序'];
const SORT_MODES = ['name', 'updated'] as const;

Page({
  data: {
    ...todoPageThemeData(),
    loading: true,
    savingCalendar: false,
    savingContacts: false,
    defaultHasEnd: false,
    durationIndex: 1,
    durationLabels: DURATION_LABELS,
    selectTodayOnOpen: true,
    sortIndex: 0,
    sortLabels: SORT_LABELS,
    showHandleInList: true,
  },

  onShow() {
    this.loadAll();
  },

  loadAll() {
    this.setData({ loading: true });
    loadContentPrefs()
      .then((prefs) => {
        const durationIndex = Math.max(
          0,
          DURATION_MINUTES.indexOf(prefs.calendar.defaultDurationMinutes),
        );
        const sortIndex = Math.max(0, SORT_MODES.indexOf(prefs.contacts.sortMode));
        this.setData({
          loading: false,
          defaultHasEnd: prefs.calendar.defaultHasEnd,
          durationIndex: durationIndex >= 0 ? durationIndex : 1,
          selectTodayOnOpen: prefs.calendar.selectTodayOnOpen,
          sortIndex: sortIndex >= 0 ? sortIndex : 0,
          showHandleInList: prefs.contacts.showHandleInList,
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  saveCalendarPatch(patch: Partial<CalendarContentPrefs>) {
    this.setData({ savingCalendar: true });
    saveContentPrefs({ calendar: patch })
      .then((prefs) => {
        const durationIndex = Math.max(
          0,
          DURATION_MINUTES.indexOf(prefs.calendar.defaultDurationMinutes),
        );
        this.setData({
          savingCalendar: false,
          defaultHasEnd: prefs.calendar.defaultHasEnd,
          durationIndex: durationIndex >= 0 ? durationIndex : 1,
          selectTodayOnOpen: prefs.calendar.selectTodayOnOpen,
        });
        wx.showToast({ title: '已保存', icon: 'success' });
      })
      .catch(() => {
        this.setData({ savingCalendar: false });
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
  },

  onDefaultHasEndChange(e: { detail: { value: boolean } }) {
    this.saveCalendarPatch({ defaultHasEnd: e.detail.value });
  },

  onDurationChange(e: { detail: { value: number } }) {
    const index = Number(e.detail.value) || 0;
    const minutes = DURATION_MINUTES[index] ?? 60;
    this.setData({ durationIndex: index });
    this.saveCalendarPatch({ defaultDurationMinutes: minutes });
  },

  onSelectTodayChange(e: { detail: { value: boolean } }) {
    this.saveCalendarPatch({ selectTodayOnOpen: e.detail.value });
  },

  saveContactsPatch(patch: Partial<ContactsContentPrefs>) {
    this.setData({ savingContacts: true });
    saveContentPrefs({ contacts: patch })
      .then((prefs) => {
        const sortIndex = Math.max(0, SORT_MODES.indexOf(prefs.contacts.sortMode));
        this.setData({
          savingContacts: false,
          sortIndex: sortIndex >= 0 ? sortIndex : 0,
          showHandleInList: prefs.contacts.showHandleInList,
        });
        wx.showToast({ title: '已保存', icon: 'success' });
      })
      .catch(() => {
        this.setData({ savingContacts: false });
        wx.showToast({ title: '保存失败', icon: 'none' });
      });
  },

  onSortChange(e: { detail: { value: number } }) {
    const index = Number(e.detail.value) || 0;
    const mode = SORT_MODES[index] ?? 'name';
    this.setData({ sortIndex: index });
    this.saveContactsPatch({ sortMode: mode });
  },

  onShowHandleChange(e: { detail: { value: boolean } }) {
    this.saveContactsPatch({ showHandleInList: e.detail.value });
  },
});
