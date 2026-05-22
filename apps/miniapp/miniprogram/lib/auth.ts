import { fetchMe, request } from "./api";
import { getConfig, saveConfig } from "./config";

export interface WechatLoginResult {
  accessToken: string;
  user: {
    id: string;
    displayName: string;
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
  return performWechatLogin();
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
