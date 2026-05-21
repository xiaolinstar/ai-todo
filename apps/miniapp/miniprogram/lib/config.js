"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
exports.saveConfig = saveConfig;
exports.clearToken = clearToken;
const STORAGE_API_URL = "apiUrl";
const STORAGE_TOKEN = "token";
function getConfig() {
    return {
        apiUrl: wx.getStorageSync(STORAGE_API_URL) || "http://127.0.0.1:3100",
        token: wx.getStorageSync(STORAGE_TOKEN) || ""
    };
}
function saveConfig(patch) {
    if (patch.apiUrl !== undefined) {
        wx.setStorageSync(STORAGE_API_URL, patch.apiUrl.trim());
    }
    if (patch.token !== undefined) {
        wx.setStorageSync(STORAGE_TOKEN, patch.token.trim());
    }
}
function clearToken() {
    wx.removeStorageSync(STORAGE_TOKEN);
}
