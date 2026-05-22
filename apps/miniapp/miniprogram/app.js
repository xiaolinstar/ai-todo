"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("./lib/auth");
App({
    globalData: {},
    onLaunch() {
        const apiUrl = wx.getStorageSync("apiUrl");
        if (!apiUrl) {
            wx.setStorageSync("apiUrl", "http://127.0.0.1:3100");
        }
        (0, auth_1.ensureAuth)().catch(() => undefined);
    }
});
