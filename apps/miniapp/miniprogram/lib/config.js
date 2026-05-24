"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCAL_API_URL = exports.PRODUCTION_API_URL = void 0;
exports.getDefaultApiUrl = getDefaultApiUrl;
exports.getConfig = getConfig;
exports.saveConfig = saveConfig;
exports.clearToken = clearToken;
const STORAGE_API_URL = "apiUrl";
const STORAGE_TOKEN = "token";
/** 生产环境 API（经 xiaolin-gateway 反代，宿主机 :8082） */
exports.PRODUCTION_API_URL = "https://wodi.games";
exports.LOCAL_API_URL = "http://127.0.0.1:3100";
function getDefaultApiUrl() {
    try {
        const { miniProgram } = wx.getAccountInfoSync();
        if (miniProgram.envVersion === "develop") {
            return exports.LOCAL_API_URL;
        }
    }
    catch (_a) {
        // DevTools 以外环境走生产默认
    }
    return exports.PRODUCTION_API_URL;
}
function getConfig() {
    return {
        apiUrl: wx.getStorageSync(STORAGE_API_URL) || getDefaultApiUrl(),
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
