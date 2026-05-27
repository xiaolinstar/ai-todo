const STORAGE_API_URL = "apiUrl";
const STORAGE_TOKEN = "token";

/** 生产环境 API（经 xiaolin-gateway 反代，宿主机 :8082） */
export const PRODUCTION_API_URL = "https://wodi.games";
export const LOCAL_API_URL = "http://127.0.0.1:3100";

export interface AppConfig {
  apiUrl: string;
  token: string;
}

export function getMiniProgramEnvVersion(): string {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion;
  } catch {
    return "release";
  }
}

export function isDevelopEnv(): boolean {
  return getMiniProgramEnvVersion() === "develop";
}

export function getDefaultApiUrl(): string {
  if (isDevelopEnv()) {
    return LOCAL_API_URL;
  }
  return PRODUCTION_API_URL;
}

function readStorageString(key: string): string {
  const value = wx.getStorageSync(key);
  return typeof value === "string" ? value : "";
}

export function getConfig(): AppConfig {
  const storedApiUrl = readStorageString(STORAGE_API_URL);
  const apiUrl = isDevelopEnv() ? storedApiUrl || getDefaultApiUrl() : PRODUCTION_API_URL;
  return {
    apiUrl,
    token: readStorageString(STORAGE_TOKEN)
  };
}

export function saveConfig(patch: Partial<AppConfig>): void {
  if (patch.apiUrl !== undefined) {
    wx.setStorageSync(STORAGE_API_URL, isDevelopEnv() ? patch.apiUrl.trim() : PRODUCTION_API_URL);
  }
  if (patch.token !== undefined) {
    wx.setStorageSync(STORAGE_TOKEN, patch.token.trim());
  }
}

export function clearToken(): void {
  wx.removeStorageSync(STORAGE_TOKEN);
}
