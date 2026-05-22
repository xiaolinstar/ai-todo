"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginWithWechat = loginWithWechat;
exports.ensureAuth = ensureAuth;
const api_1 = require("./api");
const config_1 = require("./config");
function loginWithWechat() {
    return new Promise((resolve, reject) => {
        wx.login({
            success(res) {
                if (!res.code) {
                    reject(new Error("WeChat login did not return a code."));
                    return;
                }
                (0, api_1.request)("/v1/auth/wechat/login", {
                    method: "POST",
                    data: { code: res.code }
                })
                    .then(resolve)
                    .catch(reject);
            },
            fail(err) {
                reject(err);
            }
        });
    });
}
function ensureAuth() {
    const { token } = (0, config_1.getConfig)();
    if (token) {
        return (0, api_1.fetchMe)().then((response) => {
            if (response.ok) {
                return true;
            }
            return performWechatLogin();
        });
    }
    return performWechatLogin();
}
function performWechatLogin() {
    return loginWithWechat().then((response) => {
        if (!response.ok || !response.data) {
            return false;
        }
        (0, config_1.saveConfig)({ token: response.data.accessToken });
        return true;
    });
}
