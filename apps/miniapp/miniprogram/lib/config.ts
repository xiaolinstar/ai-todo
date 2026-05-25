const STORAGE_API_URL = "apiUrl";
const STORAGE_TOKEN = "token";

/** 生产环境 API（经 xiaolin-gateway 反代，宿主机 :8082） */
export const PRODUCTION_API_URL = "https://wodi.games";
export const LOCAL_API_URL = "http://127.0.0.1:3100";

export interface AppConfig {
  apiUrl: string;
  token: string;
}

export function getDefaultApiUrl(): string {
  try {
    const { miniProgram } = wx.getAccountInfoSync();
    if (miniProgram.envVersion === "develop") {
      return LOCAL_API_URL;
    }
  } catch {
    // DevTools 以外环境走生产默认
  }
  return PRODUCTION_API_URL;
}

function readStorageString(key: string): string {
  const value = wx.getStorageSync(key);
  return typeof value === "string" ? value : "";
}

export function getConfig(): AppConfig {
  return {
    apiUrl: readStorageString(STORAGE_API_URL) || getDefaultApiUrl(),
    token: readStorageString(STORAGE_TOKEN)
  };
}

export function saveConfig(patch: Partial<AppConfig>): void {
  if (patch.apiUrl !== undefined) {
    wx.setStorageSync(STORAGE_API_URL, patch.apiUrl.trim());
  }
  if (patch.token !== undefined) {
    wx.setStorageSync(STORAGE_TOKEN, patch.token.trim());
  }
}

export function clearToken(): void {
  wx.removeStorageSync(STORAGE_TOKEN);
}
