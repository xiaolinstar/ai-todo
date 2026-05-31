import { completeReminder, deleteReminder, fetchMe, fetchRemindersToday } from "../../lib/api";
import type { ReminderSummary } from "../../lib/api";
import {
  buildReminderSubline,
  formatDateTime,
  formatIsoDateLabel,
  formatWeekdayLong,
  isOverdueDueAt,
  todayIsoDate
} from "../../lib/format";
import { updateTabBarSelected } from "../../lib/tab-bar";

interface ReminderView extends ReminderSummary {
  dueLabel: string;
  contactNames: string;
  subline: string;
  isOverdue: boolean;
  completing: boolean;
  exiting: boolean;
  deleting: boolean;
  swipeX: number;
  swiping: boolean;
}

const COMPLETE_HOLD_MS = 1200;
const EXIT_ANIM_MS = 340;
const SWIPE_OPEN_THRESHOLD_RATIO = 0.42;

type TabKey = "pending" | "completed";

function enrichReminder(item: ReminderSummary): ReminderView {
  const completed = item.status === "completed";
  const dueLabel = formatDateTime(item.dueAt);
  const contactNames = (item.contacts || []).map((c) => c.displayName).join("、");
  const isOverdue = isOverdueDueAt(item.dueAt, completed);

  return {
    ...item,
    dueLabel,
    contactNames,
    isOverdue,
    subline: buildReminderSubline({
      status: item.status,
      dueAt: item.dueAt,
      dueLabel,
      contactNames,
      isOverdue
    }),
    completing: false,
    exiting: false,
    deleting: false,
    swipeX: 0,
    swiping: false
  };
}

Page({
  data: {
    loading: false,
    loaded: false,
    error: "",
    dateLabel: "",
    weekdayLabel: "",
    timezone: "",
    activeTab: "pending" as TabKey,
    pendingCount: 0,
    completedCount: 0,
    overdueCount: 0,
    pending: [] as ReminderView[],
    completed: [] as ReminderView[]
  },

  _completeTimers: {} as Record<string, ReturnType<typeof setTimeout>>,
  _touchStartX: 0,
  _touchStartY: 0,
  _swipeItemId: "",
  _deleteActionWidthPx: 86,

  onShow() {
    updateTabBarSelected(0);
    this.updateDeleteActionWidth();
    this.loadReminders();
  },

  onUnload() {
    Object.keys(this._completeTimers).forEach((id) => {
      this.clearCompleteTimer(id);
    });
  },

  onPullDownRefresh() {
    this.loadReminders().finally(() => wx.stopPullDownRefresh());
  },

  loadReminders() {
    this.setData({ loading: true, error: "" });
    const date = todayIsoDate();

    return Promise.all([fetchRemindersToday(), fetchMe()])
      .then(([remindersRes, meRes]) => {
        if (!remindersRes.ok || !remindersRes.data) {
          this.setData({
            loading: false,
            loaded: true,
            error: remindersRes.error?.message || "加载失败，请在「我的」页检查 API 地址"
          });
          return;
        }

        const timezone = meRes.ok && meRes.data ? meRes.data.user.timezone : "";
        const items = remindersRes.data.items.map(enrichReminder);
        const animating = this.data.pending.filter(
          (item: ReminderView) => item.completing || item.exiting
        );
        const animatingIds = new Set(animating.map((item: ReminderView) => item.id));
        const serverPending = items.filter((item) => item.status !== "completed");
        const pending = [
          ...animating,
          ...serverPending.filter((item) => !animatingIds.has(item.id))
        ];
        const completed = items.filter((item) => item.status === "completed");

        this.setData({
          loading: false,
          loaded: true,
          dateLabel: formatIsoDateLabel(date),
          weekdayLabel: formatWeekdayLong(date),
          timezone,
          pendingCount: pending.length,
          completedCount: completed.length,
          overdueCount: pending.filter((item) => item.isOverdue).length,
          pending,
          completed
        });
      })
      .catch(() => {
        this.setData({
          loading: false,
          loaded: true,
          error: "无法连接 API，请在「我的」页配置地址并开启「不校验合法域名」"
        });
      });
  },

  onTabChange(e: { currentTarget: { dataset: { tab: TabKey } } }) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
  },

  goMine() {
    wx.switchTab({ url: "/pages/mine/mine" });
  },

  updateDeleteActionWidth() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      this._deleteActionWidthPx = Math.round((systemInfo.windowWidth * 160) / 750);
    } catch {
      this._deleteActionWidthPx = 86;
    }
  },

  updateCounts(pending: ReminderView[], completed: ReminderView[]) {
    this.setData({
      pendingCount: pending.length,
      completedCount: completed.length,
      overdueCount: pending.filter((item) => item.isOverdue && !item.completing).length
    });
  },

  patchPendingItem(id: string, patch: Partial<ReminderView>) {
    const pending = this.data.pending.map((item: ReminderView) =>
      item.id === id ? { ...item, ...patch } : item
    );
    this.setData({ pending });
    return pending;
  },

  patchReminderItem(id: string, patch: Partial<ReminderView>) {
    const pending = this.data.pending.map((item: ReminderView) =>
      item.id === id ? { ...item, ...patch } : item
    );
    const completed = this.data.completed.map((item: ReminderView) =>
      item.id === id ? { ...item, ...patch } : item
    );
    this.setData({ pending, completed });
    return { pending, completed };
  },

  closeOpenSwipes(exceptId = "") {
    const closeItem = (item: ReminderView) =>
      item.id === exceptId || item.swipeX === 0
        ? item
        : { ...item, swipeX: 0, swiping: false };
    this.setData({
      pending: this.data.pending.map(closeItem),
      completed: this.data.completed.map(closeItem)
    });
  },

  clearCompleteTimer(id: string) {
    const timer = this._completeTimers[id];
    if (timer) {
      clearTimeout(timer);
      delete this._completeTimers[id];
    }
  },

  scheduleCompleteTimer(id: string, delay: number, callback: () => void) {
    this.clearCompleteTimer(id);
    this._completeTimers[id] = setTimeout(callback, delay);
  },

  finalizeCompletedItem(id: string) {
    const item = this.data.pending.find((entry: ReminderView) => entry.id === id);
    if (!item) return;

    const completedItem: ReminderView = enrichReminder({
      ...item,
      status: "completed"
    });

    const pending = this.data.pending.filter((entry: ReminderView) => entry.id !== id);
    const completed = [
      completedItem,
      ...this.data.completed.filter((entry: ReminderView) => entry.id !== id)
    ];

    this.setData({ pending, completed });
    this.updateCounts(pending, completed);
    this.clearCompleteTimer(id);
  },

  revertCompletingItem(id: string) {
    this.clearCompleteTimer(id);
    this.patchPendingItem(id, { completing: false, exiting: false });
  },

  onComplete(e: { currentTarget: { dataset: { id: string } } }) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.pending.find((entry: ReminderView) => entry.id === id);
    if (!item || item.completing || item.exiting || item.deleting || item.swipeX < 0) return;

    this.patchPendingItem(id, { completing: true });

    completeReminder(id)
      .then((response) => {
        if (!response.ok) {
          this.revertCompletingItem(id);
          wx.showToast({ title: response.error?.message || "操作失败", icon: "none" });
          return;
        }

        this.scheduleCompleteTimer(id, COMPLETE_HOLD_MS, () => {
          this.patchPendingItem(id, { exiting: true });

          this.scheduleCompleteTimer(id, EXIT_ANIM_MS, () => {
            this.finalizeCompletedItem(id);
          });
        });
      })
      .catch(() => {
        this.revertCompletingItem(id);
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  onSwipeStart(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }) {
    const touch = e.touches[0];
    if (!touch) return;
    const id = e.currentTarget.dataset.id;
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
    this._swipeItemId = id;
    this.closeOpenSwipes(id);
    this.patchReminderItem(id, { swiping: true });
  },

  onSwipeMove(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }) {
    const touch = e.touches[0];
    const id = e.currentTarget.dataset.id;
    if (!touch || id !== this._swipeItemId) return;

    const deltaX = touch.clientX - this._touchStartX;
    const deltaY = touch.clientY - this._touchStartY;
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) return;

    const swipeX = Math.max(-this._deleteActionWidthPx, Math.min(0, deltaX));
    this.patchReminderItem(id, { swipeX, swiping: true });
  },

  onSwipeEnd(e: { currentTarget: { dataset: { id: string } } }) {
    const id = e.currentTarget.dataset.id;
    const item =
      this.data.pending.find((entry: ReminderView) => entry.id === id) ||
      this.data.completed.find((entry: ReminderView) => entry.id === id);
    if (!item) return;

    const shouldOpen =
      Math.abs(item.swipeX) >= this._deleteActionWidthPx * SWIPE_OPEN_THRESHOLD_RATIO;
    this.patchReminderItem(id, {
      swipeX: shouldOpen ? -this._deleteActionWidthPx : 0,
      swiping: false
    });
    this._swipeItemId = "";
  },

  onDeleteTap(e: { currentTarget: { dataset: { id: string } } }) {
    const id = e.currentTarget.dataset.id;
    const item =
      this.data.pending.find((entry: ReminderView) => entry.id === id) ||
      this.data.completed.find((entry: ReminderView) => entry.id === id);
    if (!item || item.deleting || item.completing || item.exiting) return;

    wx.showModal({
      title: "删除提醒",
      content: `确定删除“${item.title}”？`,
      confirmText: "删除",
      confirmColor: "#FF3B30",
      success: (res) => {
        if (!res.confirm) {
          this.patchReminderItem(id, { swipeX: 0, swiping: false });
          return;
        }
        this.deleteItem(id);
      }
    });
  },

  deleteItem(id: string) {
    this.patchReminderItem(id, { deleting: true, exiting: true, swiping: false });
    deleteReminder(id)
      .then((response) => {
        if (!response.ok) {
          this.patchReminderItem(id, { deleting: false, exiting: false, swipeX: 0 });
          wx.showToast({ title: response.error?.message || "删除失败", icon: "none" });
          return;
        }

        setTimeout(() => {
          const pending = this.data.pending.filter((entry: ReminderView) => entry.id !== id);
          const completed = this.data.completed.filter((entry: ReminderView) => entry.id !== id);
          this.setData({ pending, completed });
          this.updateCounts(pending, completed);
          this.clearCompleteTimer(id);
          wx.showToast({ title: "已删除", icon: "success" });
        }, EXIT_ANIM_MS);
      })
      .catch(() => {
        this.patchReminderItem(id, { deleting: false, exiting: false, swipeX: 0 });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
