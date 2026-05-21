"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../lib/api");
const format_1 = require("../../lib/format");
Page({
    data: {
        title: "",
        hasDue: true,
        dueDate: "",
        dueTime: "",
        selectedContact: null,
        submitting: false
    },
    onLoad() {
        this.setData({
            dueDate: (0, format_1.todayIsoDate)(),
            dueTime: (0, format_1.nowIsoTime)()
        });
    },
    onTitleInput(e) {
        this.setData({ title: e.detail.value });
    },
    onDueToggle(e) {
        this.setData({ hasDue: e.detail.value });
    },
    onDateChange(e) {
        this.setData({ dueDate: e.detail.value });
    },
    onTimeChange(e) {
        this.setData({ dueTime: e.detail.value });
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
        const payload = { title };
        if (this.data.hasDue) {
            payload.dueAt = (0, format_1.combineDateTime)(this.data.dueDate, this.data.dueTime);
        }
        if (this.data.selectedContact) {
            payload.contactIds = [this.data.selectedContact.id];
        }
        this.setData({ submitting: true });
        (0, api_1.createReminder)(payload)
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
