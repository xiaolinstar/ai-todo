import { completeReminder, deleteReminder, fetchMe, fetchRemindersToday } from "../../lib/api";
import { TODO_MODAL_CONFIRM_DANGER } from "../../lib/design-tokens";
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
  pressing: boolean;
  deleteVisible: boolean;
}

const COMPLETE_HOLD_MS = 1200;
const EXIT_ANIM_MS = 340;
const SWIPE_OPEN_THRESHOLD_RATIO = 0.42;
const SWIPE_TRIGGER_PX = 28;
const TAP_SLOP_PX = 12;

type TabKey = "pending" | "completed";

function enrichReminder(item: ReminderSummary): ReminderView {
  const completed = item.status === "completed";
  const dueLabel = formatDateTime(item.dueAt);
  const contactNames = (item.contacts || [])
    .map((c) => (c.handle ? c.handle : c.displayName))
    .join("、");
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
    swiping: false,
    pressing: false,
    deleteVisible: false
  };
}

function isDeleteRevealed(swipeX: number): boolean {
  return Math.abs(swipeX) >= SWIPE_TRIGGER_PX;
}

function touchPoint(e: { touches?: Array<{ clientX: number; clientY: number }> }): {
  x: number;
  y: number;
} | null {
  const touch = e.touches?.[0];
  if (!touch) return null;
  return { x: touch.clientX, y: touch.clientY };
}

function changedTouchPoint(e: {
  changedTouches?: Array<{ clientX: number; clientY: number }>;
}): { x: number; y: number } | null {
  const touch = e.changedTouches?.[0];
  if (!touch) return null;
  return { x: touch.clientX, y: touch.clientY };
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
  _startSwipeX: 0,
  _activeRowId: "",
  _gestureSwipeActive: false,
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

  findReminderItem(id: string): ReminderView | undefined {
    return (
      this.data.pending.find((entry: ReminderView) => entry.id === id) ||
      this.data.completed.find((entry: ReminderView) => entry.id === id)
    );
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

  resetRowGesture() {
    this._activeRowId = "";
    this._gestureSwipeActive = false;
    this._startSwipeX = 0;
  },

  closeOpenSwipes(exceptId = "") {
    const closeItem = (item: ReminderView) =>
      item.id === exceptId || item.swipeX === 0
        ? item
        : { ...item, swipeX: 0, swiping: false, pressing: false, deleteVisible: false };
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
    if (!item || item.completing || item.exiting || item.deleting) return;

    this.patchPendingItem(id, { completing: true, pressing: false });

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

  onRowTouchStart(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }) {
    const point = touchPoint(e);
    if (!point) return;
    const id = e.currentTarget.dataset.id;

    const item = this.findReminderItem(id);
    if (!item || item.completing || item.exiting || item.deleting) return;

    this._activeRowId = id;
    this._gestureSwipeActive = false;
    this._touchStartX = point.x;
    this._touchStartY = point.y;
    this._startSwipeX = item.swipeX;
    this.closeOpenSwipes(id);
    this.patchReminderItem(id, {
      pressing: true,
      swiping: false,
      deleteVisible: isDeleteRevealed(item.swipeX)
    });
  },

  onSwipeMove(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }) {
    const point = touchPoint(e);
    const id = e.currentTarget.dataset.id;
    if (!point || id !== this._activeRowId) return;

    const deltaX = point.x - this._touchStartX;
    const deltaY = point.y - this._touchStartY;
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) return;

    const canSwipe =
      this._gestureSwipeActive ||
      this._startSwipeX !== 0 ||
      Math.abs(deltaX) >= SWIPE_TRIGGER_PX;
    if (!canSwipe) return;

    this._gestureSwipeActive = true;
    const swipeX = Math.max(
      -this._deleteActionWidthPx,
      Math.min(0, this._startSwipeX + deltaX)
    );
    this.patchReminderItem(id, {
      swipeX,
      swiping: true,
      pressing: false,
      deleteVisible: isDeleteRevealed(swipeX)
    });
  },

  onRowTouchEnd(e: {
    currentTarget: { dataset: { id: string } };
    changedTouches?: Array<{ clientX: number; clientY: number }>;
  }) {
    const id = e.currentTarget.dataset.id;
    if (id !== this._activeRowId) {
      this.resetRowGesture();
      return;
    }

    const item = this.findReminderItem(id);
    if (!item) {
      this.resetRowGesture();
      return;
    }

    const point = changedTouchPoint(e);
    const moved = point
      ? Math.hypot(point.x - this._touchStartX, point.y - this._touchStartY)
      : 0;

    let swipeX = item.swipeX;
    if (this._gestureSwipeActive) {
      const shouldOpen =
        Math.abs(swipeX) >= this._deleteActionWidthPx * SWIPE_OPEN_THRESHOLD_RATIO;
      swipeX = shouldOpen ? -this._deleteActionWidthPx : 0;
    } else if (moved < TAP_SLOP_PX) {
      swipeX = 0;
      if (!isDeleteRevealed(this._startSwipeX) && !item.completing && !item.deleting) {
        this.openReminderEdit(id);
      }
    } else {
      swipeX = this._startSwipeX;
    }

    this.patchReminderItem(id, {
      swipeX,
      swiping: false,
      pressing: false,
      deleteVisible: isDeleteRevealed(swipeX)
    });
    this.resetRowGesture();
  },

  openReminderEdit(id: string) {
    const item = this.findReminderItem(id);
    if (!item || item.completing || item.exiting || item.deleting) return;
    wx.navigateTo({ url: `/pages/reminder-edit/reminder-edit?id=${encodeURIComponent(id)}` });
  },

  onDeleteTap(e: { currentTarget: { dataset: { id: string } } }) {
    const id = e.currentTarget.dataset.id;
    const item = this.findReminderItem(id);
    if (!item || item.deleting || item.completing || item.exiting) return;

    wx.showModal({
      title: "删除提醒",
      content: `确定删除“${item.title}”？`,
      confirmText: "删除",
      confirmColor: TODO_MODAL_CONFIRM_DANGER,
      success: (res) => {
        if (!res.confirm) {
          this.patchReminderItem(id, { swipeX: 0, swiping: false, deleteVisible: false });
          return;
        }
        this.deleteItem(id);
      }
    });
  },

  deleteItem(id: string) {
    this.patchReminderItem(id, {
      deleting: true,
      exiting: true,
      swiping: false,
      deleteVisible: false
    });
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
