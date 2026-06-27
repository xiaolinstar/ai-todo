import { fetchNotificationStatus } from '../../lib/api';
import {
  formatNotificationStatusLabel,
  formatNotificationTargetType,
  notificationStatusHint,
} from '../../lib/notification-labels';
import { todoPageThemeData } from '../../lib/theme';

interface StatusRow {
  id: string;
  title: string;
  meta: string;
  statusClass: string;
}

Page({
  data: {
    ...todoPageThemeData(),
    loading: true,
    statusItems: [] as StatusRow[],
  },

  onShow() {
    this.loadStatus();
  },

  loadStatus() {
    this.setData({ loading: true });
    fetchNotificationStatus(20)
      .then((response) => {
        this.setData({
          loading: false,
          statusItems: this.mapStatusItems(response.data?.items ?? []),
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  mapStatusItems(
    items: Array<{
      id: string;
      targetType: string;
      targetId: string;
      targetTitle?: string;
      status: string;
      scheduledAt: string;
      attemptCount?: number;
    }>,
  ): StatusRow[] {
    return items.map((item) => {
      const typeLabel = formatNotificationTargetType(item.targetType);
      const name = (item.targetTitle || '').trim() || item.targetId.slice(0, 8);
      const statusLabel = formatNotificationStatusLabel(item.status);
      const statusClass = item.status === 'failed' || item.status === 'no_quota' ? 'danger' : '';
      const hint = notificationStatusHint(item);
      const attemptSuffix =
        item.attemptCount && item.attemptCount > 0 ? ` · 第 ${item.attemptCount} 次` : '';
      return {
        id: item.id,
        title: `${typeLabel} · ${name}`,
        meta: `${statusLabel}${attemptSuffix} · ${item.scheduledAt}${hint ? ` · ${hint}` : ''}`,
        statusClass,
      };
    });
  },
});
