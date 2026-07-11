import { handleApiError } from '../../lib/error-handler';
import { fetchMe, updateProfile } from '../../lib/api';
import { formatNowClock, todayIsoDate, todayIsoDateInTimezone } from '../../lib/format';
import { TIMEZONE_OPTIONS, timezoneIndex, timezoneLabel } from '../../lib/timezones';
import { todoPageThemeData } from '../../lib/theme';

Page({
  data: {
    ...todoPageThemeData(),
    loading: true,
    saving: false,
    timezoneId: 'Asia/Shanghai',
    timezoneLabel: timezoneLabel('Asia/Shanghai'),
    timezoneIndex: 0,
    timezoneLabels: TIMEZONE_OPTIONS.map((item) => item.label),
    nowClock: '',
    accountToday: '',
    deviceToday: todayIsoDate(),
  },

  _clockTimer: 0 as ReturnType<typeof setInterval> | 0,
  _savedTimezoneId: 'Asia/Shanghai',

  onShow() {
    this.loadTimezone();
    this.startClock();
  },

  onUnload() {
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
      this._clockTimer = 0;
    }
  },

  startClock() {
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
    }
    const tick = () => {
      const tz = this.data.timezoneId;
      if (!tz) return;
      this.setData({
        nowClock: formatNowClock(tz),
        accountToday: todayIsoDateInTimezone(tz),
        deviceToday: todayIsoDate(),
      });
    };
    tick();
    this._clockTimer = setInterval(tick, 15000);
  },

  loadTimezone() {
    this.setData({ loading: true });
    fetchMe()
      .then((response) => {
        if (!response.ok || !response.data) {
          handleApiError(response.error, '加载失败');
          setTimeout(() => wx.navigateBack(), 600);
          return;
        }
        const timezoneId = response.data.user.timezone || 'Asia/Shanghai';
        const index = timezoneIndex(timezoneId);
        this._savedTimezoneId = timezoneId;
        this.setData({
          loading: false,
          timezoneId,
          timezoneIndex: index,
          timezoneLabel: timezoneLabel(timezoneId),
          nowClock: formatNowClock(timezoneId),
          accountToday: todayIsoDateInTimezone(timezoneId),
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '无法连接 API', icon: 'none' });
      });
  },

  onTimezoneChange(e: { detail: { value: string } }) {
    const index = Number(e.detail.value);
    const option = TIMEZONE_OPTIONS[index];
    if (!option || option.id === this._savedTimezoneId) return;
    this.setData({
      timezoneIndex: index,
      timezoneId: option.id,
      timezoneLabel: option.label,
      nowClock: formatNowClock(option.id),
      accountToday: todayIsoDateInTimezone(option.id),
    });
    this.persistTimezone(option.id);
  },

  persistTimezone(timezoneId: string) {
    if (this.data.saving) return;
    this.setData({ saving: true });
    updateProfile({ timezone: timezoneId })
      .then((response) => {
        this.setData({ saving: false });
        if (!response.ok) {
          handleApiError(response.error, '保存失败');
          this.loadTimezone();
          return;
        }
        this._savedTimezoneId = timezoneId;
        wx.showToast({ title: '已更新', icon: 'success' });
      })
      .catch(() => {
        this.setData({ saving: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
        this.loadTimezone();
      });
  },
});
