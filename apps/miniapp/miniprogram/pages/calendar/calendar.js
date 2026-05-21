"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../lib/api");
const format_1 = require("../../lib/format");
const tab_bar_1 = require("../../lib/tab-bar");
Page({
    data: {
        loading: false,
        loaded: false,
        error: "",
        selectedDate: "",
        dateLabel: "",
        monthLabel: "",
        weekdayLabel: "",
        isToday: true,
        timezone: "",
        weekDays: [],
        events: []
    },
    onLoad() {
        this.setData({ selectedDate: (0, format_1.todayIsoDate)() });
    },
    onShow() {
        (0, tab_bar_1.updateTabBarSelected)(1);
        this.loadEvents();
    },
    onPullDownRefresh() {
        this.loadEvents().finally(() => wx.stopPullDownRefresh());
    },
    loadEvents() {
        const selectedDate = this.data.selectedDate || (0, format_1.todayIsoDate)();
        this.setData({ loading: true, error: "" });
        const eventsRequest = (0, format_1.isTodayIsoDate)(selectedDate)
            ? (0, api_1.fetchCalendarToday)()
            : (0, api_1.fetchCalendarByDate)(selectedDate);
        return Promise.all([eventsRequest, (0, api_1.fetchMe)()])
            .then(([eventsRes, meRes]) => {
            var _a;
            if (!eventsRes.ok || !eventsRes.data) {
                this.setData({
                    loading: false,
                    loaded: true,
                    error: ((_a = eventsRes.error) === null || _a === void 0 ? void 0 : _a.message) || "加载失败，请在「我的」页检查 API 地址"
                });
                return;
            }
            const timezone = meRes.ok && meRes.data ? meRes.data.user.timezone : "";
            this.setData({
                loading: false,
                loaded: true,
                selectedDate,
                dateLabel: (0, format_1.formatIsoDateLabel)(selectedDate),
                monthLabel: (0, format_1.formatMonthYear)(selectedDate),
                weekdayLabel: (0, format_1.formatWeekdayLong)(selectedDate),
                isToday: (0, format_1.isTodayIsoDate)(selectedDate),
                timezone,
                weekDays: (0, format_1.buildWeekStrip)(selectedDate),
                events: eventsRes.data.items.map((item, index) => (Object.assign(Object.assign({}, item), { timeLabel: (0, format_1.formatEventTimeRange)(item.startAt, item.endAt), contactNames: (item.contacts || []).map((c) => c.displayName).join("、"), accentColor: (0, format_1.eventAccentColor)(index) })))
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
    onSelectDay(e) {
        const iso = e.currentTarget.dataset.iso;
        if (!iso || iso === this.data.selectedDate)
            return;
        this.setData({ selectedDate: iso }, () => this.loadEvents());
    },
    goToday() {
        this.setData({ selectedDate: (0, format_1.todayIsoDate)() }, () => this.loadEvents());
    },
    goMine() {
        wx.switchTab({ url: "/pages/mine/mine" });
    }
});
