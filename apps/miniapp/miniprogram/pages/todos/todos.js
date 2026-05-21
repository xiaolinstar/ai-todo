"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../lib/api");
const format_1 = require("../../lib/format");
const tab_bar_1 = require("../../lib/tab-bar");
const COMPLETE_HOLD_MS = 1200;
const EXIT_ANIM_MS = 340;
function enrichReminder(item) {
    const completed = item.status === "completed";
    const dueLabel = (0, format_1.formatDateTime)(item.dueAt);
    const contactNames = (item.contacts || []).map((c) => c.displayName).join("、");
    const isOverdue = (0, format_1.isOverdueDueAt)(item.dueAt, completed);
    return Object.assign(Object.assign({}, item), { dueLabel,
        contactNames,
        isOverdue, subline: (0, format_1.buildReminderSubline)({
            status: item.status,
            dueAt: item.dueAt,
            dueLabel,
            contactNames,
            isOverdue
        }), completing: false, exiting: false });
}
Page({
    data: {
        loading: false,
        loaded: false,
        error: "",
        dateLabel: "",
        weekdayLabel: "",
        timezone: "",
        activeTab: "pending",
        pendingCount: 0,
        completedCount: 0,
        overdueCount: 0,
        pending: [],
        completed: []
    },
    _completeTimers: {},
    onShow() {
        (0, tab_bar_1.updateTabBarSelected)(0);
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
        const date = (0, format_1.todayIsoDate)();
        return Promise.all([(0, api_1.fetchRemindersToday)(), (0, api_1.fetchMe)()])
            .then(([remindersRes, meRes]) => {
            var _a;
            if (!remindersRes.ok || !remindersRes.data) {
                this.setData({
                    loading: false,
                    loaded: true,
                    error: ((_a = remindersRes.error) === null || _a === void 0 ? void 0 : _a.message) || "加载失败，请在「我的」页检查 API 地址"
                });
                return;
            }
            const timezone = meRes.ok && meRes.data ? meRes.data.user.timezone : "";
            const items = remindersRes.data.items.map(enrichReminder);
            const animating = this.data.pending.filter((item) => item.completing || item.exiting);
            const animatingIds = new Set(animating.map((item) => item.id));
            const serverPending = items.filter((item) => item.status !== "completed");
            const pending = [
                ...animating,
                ...serverPending.filter((item) => !animatingIds.has(item.id))
            ];
            const completed = items.filter((item) => item.status === "completed");
            this.setData({
                loading: false,
                loaded: true,
                dateLabel: (0, format_1.formatIsoDateLabel)(date),
                weekdayLabel: (0, format_1.formatWeekdayLong)(date),
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
    onTabChange(e) {
        const tab = e.currentTarget.dataset.tab;
        if (!tab || tab === this.data.activeTab)
            return;
        this.setData({ activeTab: tab });
    },
    goMine() {
        wx.switchTab({ url: "/pages/mine/mine" });
    },
    updateCounts(pending, completed) {
        this.setData({
            pendingCount: pending.length,
            completedCount: completed.length,
            overdueCount: pending.filter((item) => item.isOverdue && !item.completing).length
        });
    },
    patchPendingItem(id, patch) {
        const pending = this.data.pending.map((item) => item.id === id ? Object.assign(Object.assign({}, item), patch) : item);
        this.setData({ pending });
        return pending;
    },
    clearCompleteTimer(id) {
        const timer = this._completeTimers[id];
        if (timer) {
            clearTimeout(timer);
            delete this._completeTimers[id];
        }
    },
    scheduleCompleteTimer(id, delay, callback) {
        this.clearCompleteTimer(id);
        this._completeTimers[id] = setTimeout(callback, delay);
    },
    finalizeCompletedItem(id) {
        const item = this.data.pending.find((entry) => entry.id === id);
        if (!item)
            return;
        const completedItem = enrichReminder(Object.assign(Object.assign({}, item), { status: "completed" }));
        const pending = this.data.pending.filter((entry) => entry.id !== id);
        const completed = [
            completedItem,
            ...this.data.completed.filter((entry) => entry.id !== id)
        ];
        this.setData({ pending, completed });
        this.updateCounts(pending, completed);
        this.clearCompleteTimer(id);
    },
    revertCompletingItem(id) {
        this.clearCompleteTimer(id);
        this.patchPendingItem(id, { completing: false, exiting: false });
    },
    onComplete(e) {
        const id = e.currentTarget.dataset.id;
        const item = this.data.pending.find((entry) => entry.id === id);
        if (!item || item.completing || item.exiting)
            return;
        this.patchPendingItem(id, { completing: true });
        (0, api_1.completeReminder)(id)
            .then((response) => {
            var _a;
            if (!response.ok) {
                this.revertCompletingItem(id);
                wx.showToast({ title: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "操作失败", icon: "none" });
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
    }
});
