"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../lib/api");
const format_1 = require("../../lib/format");
Page({
    data: {
        title: "",
        location: "",
        startDate: "",
        startTime: "",
        endDate: "",
        endTime: "",
        hasEnd: false,
        selectedContact: null,
        submitting: false
    },
    onLoad() {
        const today = (0, format_1.todayIsoDate)();
        const time = (0, format_1.nowIsoTime)();
        this.setData({
            startDate: today,
            startTime: time,
            endDate: today,
            endTime: time
        });
    },
    onTitleInput(e) {
        this.setData({ title: e.detail.value });
    },
    onLocationInput(e) {
        this.setData({ location: e.detail.value });
    },
    onEndToggle(e) {
        this.setData({ hasEnd: e.detail.value });
    },
    onStartDateChange(e) {
        this.setData({ startDate: e.detail.value });
    },
    onStartTimeChange(e) {
        this.setData({ startTime: e.detail.value });
    },
    onEndDateChange(e) {
        this.setData({ endDate: e.detail.value });
    },
    onEndTimeChange(e) {
        this.setData({ endTime: e.detail.value });
    },
    pickContact() {
        wx.navigateTo({
            url: "/pages/contact-picker/contact-picker",
            events: {
                selectContact: (contact) => {
                    this.setData({ selectedContact: contact });
                }
            }
        });
    },
    clearContact() {
        this.setData({ selectedContact: null });
    },
    onSubmit() {
        const title = this.data.title.trim();
        if (!title) {
            wx.showToast({ title: "请输入标题", icon: "none" });
            return;
        }
        const payload = {
            title,
            startAt: (0, format_1.combineDateTime)(this.data.startDate, this.data.startTime)
        };
        if (this.data.hasEnd) {
            payload.endAt = (0, format_1.combineDateTime)(this.data.endDate, this.data.endTime);
        }
        const location = this.data.location.trim();
        if (location) {
            payload.location = location;
        }
        if (this.data.selectedContact) {
            payload.contactIds = [this.data.selectedContact.id];
        }
        this.setData({ submitting: true });
        (0, api_1.createCalendarEvent)(payload)
            .then((response) => {
            var _a;
            this.setData({ submitting: false });
            if (!response.ok) {
                wx.showToast({ title: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "创建失败", icon: "none" });
                return;
            }
            wx.showToast({ title: "已创建", icon: "success" });
            setTimeout(() => wx.navigateBack(), 500);
        })
            .catch(() => {
            this.setData({ submitting: false });
            wx.showToast({ title: "网络错误", icon: "none" });
        });
    }
});
