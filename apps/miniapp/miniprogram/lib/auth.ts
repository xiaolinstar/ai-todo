import { fetchMe, request } from "./api";
import { getConfig, isDevelopEnv, saveConfig } from "./config";

export interface WechatLoginResult {
  accessToken: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string;
    timezone: string;
  };
}

export function loginWithWechat(): Promise<import("./api").ApiResponse<WechatLoginResult>> {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (!res.code) {
          reject(new Error("WeChat login did not return a code."));
          return;
        }
        request<WechatLoginResult>("/v1/auth/wechat/login", {
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

export function hasValidSession(): Promise<boolean> {
  const { token } = getConfig();
  if (!token) {
    return Promise.resolve(false);
  }
  return fetchMe().then((response) => response.ok);
}

export function ensureAuth(): Promise<boolean> {
  const { token } = getConfig();
  if (token) {
    return fetchMe().then((response) => {
      if (response.ok) {
        return true;
      }
      return performWechatLogin();
    });
  }
  // 开发者工具 + allow_dev_auth：无需微信登录即可访问 API
  if (isDevelopEnv()) {
    return fetchMe().then((response) => response.ok);
  }
  // 预览/正式版：启动时不自动 wx.login，避免 code 被消耗；用户点「微信登录」再换 code
  return Promise.resolve(false);
}

function performWechatLogin(): Promise<boolean> {
  return loginWithWechat().then((response) => {
    if (!response.ok || !response.data) {
      return false;
    }
    saveConfig({ token: response.data.accessToken });
    return true;
  });
}
