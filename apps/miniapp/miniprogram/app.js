"use strict";
App({
    globalData: {},
    onLaunch() {
        const apiUrl = wx.getStorageSync("apiUrl");
        if (!apiUrl) {
            wx.setStorageSync("apiUrl", "http://127.0.0.1:3100");
        }
    }
});
