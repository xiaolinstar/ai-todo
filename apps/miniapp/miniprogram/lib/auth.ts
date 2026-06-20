import { request } from "./api";

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
