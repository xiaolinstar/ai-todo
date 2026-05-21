import {
  completeReminder,
  fetchToday,
  type CalendarEventSummary,
  type ReminderSummary
} from "../../lib/api";
import { formatDateTime, formatTimeRange } from "../../lib/format";

interface ReminderView extends ReminderSummary {
  dueLabel: string;
  contactNames: string;
}

interface EventView extends CalendarEventSummary {
  timeLabel: string;
  contactNames: string;
}

Page({
  data: {
    loading: false,
    loaded: false,
    error: "",
    dateLabel: "",
    timezone: "",
    reminders: [] as ReminderView[],
    calendarEvents: [] as EventView[]
  },

  onShow() {
    this.loadToday();
  },

  onPullDownRefresh() {
    this.loadToday().finally(() => wx.stopPullDownRefresh());
  },

  loadToday() {
    this.setData({ loading: true, error: "" });
    return fetchToday()
      .then((response) => {
        if (!response.ok || !response.data) {
          this.setData({
            loading: false,
            loaded: true,
            error: response.error?.message || "加载失败，请检查设置中的 API 地址"
          });
          return;
        }

        const { date, timezone, reminders, calendarEvents } = response.data;
        this.setData({
          loading: false,
          loaded: true,
          dateLabel: date,
          timezone,
          reminders: reminders.map((item) => ({
            ...item,
            dueLabel: formatDateTime(item.dueAt),
            contactNames: (item.contacts || []).map((c) => c.displayName).join("、")
          })),
          calendarEvents: calendarEvents.map((item) => ({
            ...item,
            timeLabel: formatTimeRange(item.startAt, item.endAt),
            contactNames: (item.contacts || []).map((c) => c.displayName).join("、")
          }))
        });
      })
      .catch(() => {
        this.setData({
          loading: false,
          loaded: true,
          error: "无法连接 API，请在设置页配置地址并开启「不校验合法域名」"
        });
      });
  },

  goCreate() {
    wx.navigateTo({ url: "/pages/reminder-create/reminder-create" });
  },

  onComplete(e: { currentTarget: { dataset: { id: string } } }) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.reminders.find((r: ReminderView) => r.id === id);
    if (!item || item.status === "completed") return;

    wx.showLoading({ title: "处理中" });
    completeReminder(id)
      .then((response) => {
        wx.hideLoading();
        if (!response.ok) {
          wx.showToast({ title: response.error?.message || "操作失败", icon: "none" });
          return;
        }
        wx.showToast({ title: "已完成", icon: "success" });
        this.loadToday();
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
