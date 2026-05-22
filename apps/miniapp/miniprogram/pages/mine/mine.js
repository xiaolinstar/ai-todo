"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../lib/api");
const auth_1 = require("../../lib/auth");
const format_1 = require("../../lib/format");
const config_1 = require("../../lib/config");
const tab_bar_1 = require("../../lib/tab-bar");
Page({
    data: {
        apiUrl: "",
        token: "",
        userName: "",
        userId: "",
        timezone: "",
        initial: "?",
        avatarColor: "#007AFF",
        connected: false,
        testing: false,
        issuing: false,
        loggingIn: false
    },
    onShow() {
        (0, tab_bar_1.updateTabBarSelected)(3);
        const config = (0, config_1.getConfig)();
        this.setData({
            apiUrl: config.apiUrl,
            token: config.token
        });
        if (config.apiUrl) {
            this.bootstrapConnection(false);
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
        this.bootstrapConnection(true);
    },
    onClearToken() {
        (0, config_1.clearToken)();
        this.setData({
            token: "",
            userName: "",
            userId: "",
            timezone: "",
            initial: "?",
            avatarColor: "#007AFF",
            connected: false
        });
        wx.showToast({ title: "已清除 Token", icon: "none" });
    },
    onTestConnection() {
        this.bootstrapConnection(true);
    },
    onWechatLogin() {
        (0, config_1.saveConfig)({ apiUrl: this.data.apiUrl });
        this.setData({ loggingIn: true });
        (0, auth_1.loginWithWechat)()
            .then((response) => {
            var _a;
            this.setData({ loggingIn: false });
            if (!response.ok || !response.data) {
                wx.showToast({
                    title: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "微信登录失败",
                    icon: "none"
                });
                return;
            }
            (0, config_1.saveConfig)({ token: response.data.accessToken });
            this.setData({ token: response.data.accessToken });
            this.applyUser(response.data.user, true);
        })
            .catch(() => {
            this.setData({ loggingIn: false });
            wx.showToast({ title: "微信登录失败", icon: "none" });
        });
    },
    bootstrapConnection(showToast) {
        (0, config_1.saveConfig)({
            apiUrl: this.data.apiUrl,
            token: this.data.token
        });
        this.setData({ testing: true });
        return (0, auth_1.ensureAuth)()
            .then((authenticated) => {
            const config = (0, config_1.getConfig)();
            this.setData({ token: config.token });
            if (!authenticated) {
                return this.testConnection(showToast);
            }
            return (0, api_1.fetchMe)().then((response) => {
                var _a;
                this.setData({ testing: false });
                if (!response.ok || !response.data) {
                    if (showToast) {
                        wx.showToast({
                            title: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "连接失败",
                            icon: "none"
                        });
                    }
                    this.resetProfile();
                    return;
                }
                this.applyUser(response.data.user, showToast);
            });
        })
            .catch(() => {
            this.setData({ testing: false });
            this.resetProfile();
            if (showToast) {
                wx.showToast({ title: "无法连接 API", icon: "none" });
            }
        });
    },
    testConnection(showToast) {
        return (0, api_1.fetchMe)()
            .then((response) => {
            var _a;
            this.setData({ testing: false });
            if (!response.ok || !response.data) {
                if (showToast) {
                    wx.showToast({
                        title: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "连接失败",
                        icon: "none"
                    });
                }
                this.resetProfile();
                return;
            }
            this.applyUser(response.data.user, showToast);
        })
            .catch(() => {
            this.setData({ testing: false });
            this.resetProfile();
            if (showToast) {
                wx.showToast({ title: "无法连接 API", icon: "none" });
            }
        });
    },
    applyUser(user, showToast) {
        this.setData({
            userName: user.displayName,
            userId: user.id,
            timezone: user.timezone,
            initial: (0, format_1.getInitial)(user.displayName),
            avatarColor: (0, format_1.avatarColor)(user.displayName),
            connected: true
        });
        if (showToast) {
            wx.showToast({ title: "连接成功", icon: "success" });
        }
    },
    resetProfile() {
        this.setData({
            userName: "",
            userId: "",
            timezone: "",
            initial: "?",
            avatarColor: "#007AFF",
            connected: false
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
                success: () => this.bootstrapConnection(true)
            });
        })
            .catch(() => {
            this.setData({ issuing: false });
            wx.showToast({ title: "网络错误", icon: "none" });
        });
    }
});
