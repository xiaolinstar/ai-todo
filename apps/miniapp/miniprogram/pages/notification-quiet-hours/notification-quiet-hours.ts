import { fetchNotificationSettings, updateNotificationSettings } from '../../lib/api';
import { todoPageThemeData } from '../../lib/theme';

Page({
  data: {
    ...todoPageThemeData(),
    loading: true,
    saving: false,
    quietStart: '',
    quietEnd: '',
    hasQuietHours: false,
  },

  onShow() {
    this.loadSettings();
  },

  loadSettings() {
    this.setData({ loading: true });
    fetchNotificationSettings()
      .then((response) => {
        this.setData({ loading: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || '加载失败', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 600);
          return;
        }
        const quietStart = response.data.settings.quietStart || '';
        const quietEnd = response.data.settings.quietEnd || '';
        this.setData({
          quietStart,
          quietEnd,
          hasQuietHours: Boolean(quietStart || quietEnd),
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  saveQuietHours(patch: { quietStart?: string | null; quietEnd?: string | null }) {
    this.setData({ saving: true });
    updateNotificationSettings(patch)
      .then((response) => {
        this.setData({ saving: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || '保存失败', icon: 'none' });
          this.loadSettings();
          return;
        }
        const quietStart = response.data.settings.quietStart || '';
        const quietEnd = response.data.settings.quietEnd || '';
        this.setData({
          quietStart,
          quietEnd,
          hasQuietHours: Boolean(quietStart || quietEnd),
        });
        wx.showToast({ title: '已保存', icon: 'success' });
      })
      .catch(() => {
        this.setData({ saving: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
        this.loadSettings();
      });
  },

  onQuietStartChange(e: { detail: { value: string } }) {
    const quietStart = e.detail.value || null;
    this.setData({ quietStart: quietStart || '' });
    this.saveQuietHours({ quietStart });
  },

  onQuietEndChange(e: { detail: { value: string } }) {
    const quietEnd = e.detail.value || null;
    this.setData({ quietEnd: quietEnd || '' });
    this.saveQuietHours({ quietEnd });
  },

  onClearQuietHours() {
    this.saveQuietHours({ quietStart: null, quietEnd: null });
  },
});
