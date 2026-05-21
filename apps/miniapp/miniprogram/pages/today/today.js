"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../lib/api");
const format_1 = require("../../lib/format");
Page({
    data: {
        loading: false,
        loaded: false,
        error: "",
        dateLabel: "",
        timezone: "",
        reminders: [],
        calendarEvents: []
    },
    onShow() {
        this.loadToday();
    },
    onPullDownRefresh() {
        this.loadToday().finally(() => wx.stopPullDownRefresh());
    },
    loadToday() {
        this.setData({ loading: true, error: "" });
        return (0, api_1.fetchToday)()
            .then((response) => {
            var _a;
            if (!response.ok || !response.data) {
                this.setData({
                    loading: false,
                    loaded: true,
                    error: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "加载失败，请检查设置中的 API 地址"
                });
                return;
            }
            const { date, timezone, reminders, calendarEvents } = response.data;
            this.setData({
                loading: false,
                loaded: true,
                dateLabel: date,
                timezone,
                reminders: reminders.map((item) => (Object.assign(Object.assign({}, item), { dueLabel: (0, format_1.formatDateTime)(item.dueAt), contactNames: (item.contacts || []).map((c) => c.displayName).join("、") }))),
                calendarEvents: calendarEvents.map((item) => (Object.assign(Object.assign({}, item), { timeLabel: (0, format_1.formatTimeRange)(item.startAt, item.endAt), contactNames: (item.contacts || []).map((c) => c.displayName).join("、") })))
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
    onComplete(e) {
        const id = e.currentTarget.dataset.id;
        const item = this.data.reminders.find((r) => r.id === id);
        if (!item || item.status === "completed")
            return;
        wx.showLoading({ title: "处理中" });
        (0, api_1.completeReminder)(id)
            .then((response) => {
            var _a;
            wx.hideLoading();
            if (!response.ok) {
                wx.showToast({ title: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "操作失败", icon: "none" });
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
