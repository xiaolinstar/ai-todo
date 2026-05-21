const STORAGE_API_URL = "apiUrl";
const STORAGE_TOKEN = "token";

export interface AppConfig {
  apiUrl: string;
  token: string;
}

export function getConfig(): AppConfig {
  return {
    apiUrl: wx.getStorageSync<string>(STORAGE_API_URL) || "http://127.0.0.1:3100",
    token: wx.getStorageSync<string>(STORAGE_TOKEN) || ""
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
