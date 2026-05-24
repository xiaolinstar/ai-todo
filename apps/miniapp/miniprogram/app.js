"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./lib/auth");
const config_1 = require("./lib/config");
App({
    globalData: {},
    onLaunch() {
        const apiUrl = wx.getStorageSync("apiUrl");
        if (!apiUrl) {
            wx.setStorageSync("apiUrl", (0, config_1.getDefaultApiUrl)());
        }
        (0, auth_1.ensureAuth)().catch(() => undefined);
    }
});
