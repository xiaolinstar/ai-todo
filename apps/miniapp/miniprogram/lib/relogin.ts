import { getConfig, saveConfig } from './config';
import type { ApiResponse } from './api';

interface WechatLoginPayload {
  accessToken: string;
}

function buildUrl(path: string): string {
  const { apiUrl } = getConfig();
  return `${apiUrl.replace(/\/$/, '')}${path}`;
}

let reloginPromise: Promise<boolean> | null = null;

/** Mutex-guarded wx.login → session token; does not clear token on failure. */
export function silentWechatReLogin(): Promise<boolean> {
  if (reloginPromise) {
    return reloginPromise;
  }

  reloginPromise = new Promise<boolean>((resolve) => {
    wx.login({
      success(res) {
        if (!res.code) {
          resolve(false);
          return;
        }
        wx.request({
          url: buildUrl('/v1/auth/wechat/login'),
          method: 'POST',
          header: {
            'content-type': 'application/json',
            'x-client-source': 'miniapp',
          },
          data: { code: res.code },
          success(loginRes: { statusCode: number; data: unknown }) {
            if (loginRes.statusCode >= 400) {
              resolve(false);
              return;
            }
            const body = loginRes.data as ApiResponse<WechatLoginPayload> | undefined;
            if (!body?.ok || !body.data?.accessToken) {
              resolve(false);
              return;
            }
            saveConfig({ token: body.data.accessToken });
            resolve(true);
          },
          fail() {
            resolve(false);
          },
        });
      },
      fail() {
        resolve(false);
      },
    });
  }).finally(() => {
    reloginPromise = null;
  });

  return reloginPromise;
}
