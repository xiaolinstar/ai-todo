"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../lib/api");
const config_1 = require("../../lib/config");
Page({
    data: {
        apiUrl: "",
        token: "",
        userName: "",
        userId: "",
        timezone: "",
        testing: false,
        issuing: false
    },
    onShow() {
        const config = (0, config_1.getConfig)();
        this.setData({
            apiUrl: config.apiUrl,
            token: config.token
        });
        if (config.apiUrl) {
            this.onTest();
        }
    },
    onApiUrlInput(e) {
        this.setData({ apiUrl: e.detail.value });
    },
    onTokenInput(e) {
        this.setData({ token: e.detail.value });
    },
    onSave() {
        (0, config_1.saveConfig)({
            apiUrl: this.data.apiUrl,
            token: this.data.token
        });
        wx.showToast({ title: "已保存", icon: "success" });
        this.onTest();
    },
    onClearToken() {
        (0, config_1.clearToken)();
        this.setData({ token: "", userName: "", userId: "", timezone: "" });
        wx.showToast({ title: "已清除 Token", icon: "none" });
    },
    onTest() {
        (0, config_1.saveConfig)({
            apiUrl: this.data.apiUrl,
            token: this.data.token
        });
        this.setData({ testing: true });
        return (0, api_1.fetchMe)()
            .then((response) => {
            var _a;
            this.setData({ testing: false });
            if (!response.ok || !response.data) {
                wx.showToast({
                    title: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "连接失败",
                    icon: "none"
                });
                this.setData({ userName: "", userId: "", timezone: "" });
                return;
            }
            const { user } = response.data;
            this.setData({
                userName: user.displayName,
                userId: user.id,
                timezone: user.timezone
            });
            wx.showToast({ title: "连接成功", icon: "success" });
        })
            .catch(() => {
            this.setData({ testing: false, userName: "", userId: "", timezone: "" });
            wx.showToast({ title: "无法连接 API", icon: "none" });
        });
    },
    onIssuePat() {
        (0, config_1.saveConfig)({
            apiUrl: this.data.apiUrl,
            token: this.data.token
        });
        this.setData({ issuing: true });
        (0, api_1.issuePat)("Miniapp Local")
            .then((response) => {
            var _a;
            this.setData({ issuing: false });
            if (!response.ok || !response.data) {
                wx.showToast({
                    title: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "签发失败",
                    icon: "none"
                });
                return;
            }
            (0, config_1.saveConfig)({ token: response.data.token });
            this.setData({ token: response.data.token });
            wx.showModal({
                title: "PAT 已签发",
                content: "Token 已保存到本地。",
                showCancel: false,
                success: () => this.onTest()
            });
        })
            .catch(() => {
            this.setData({ issuing: false });
            wx.showToast({ title: "网络错误", icon: "none" });
        });
    }
});
