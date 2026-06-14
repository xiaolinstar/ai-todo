const STORAGE_API_URL = "apiUrl";
const LEGACY_STORAGE_TOKEN = "token";
const PROFILE_SETUP_PREFIX = "profileSetupSeen:";

/** 生产环境 API（经 xiaolin-gateway 反代，宿主机 :8082） */
export const PRODUCTION_API_URL = "https://xingxiaolin.cn";
/** 预发布 / 体验版 API（经 xiaolin-gateway 反代，宿主机 :8083） */
export const STAGING_API_URL = "https://staging.xingxiaolin.cn";
export const LOCAL_API_URL = "http://127.0.0.1:3100";

const LEGACY_PRODUCTION_API_URL = "https://www.xingxiaolin.cn";

export interface AppConfig {
  apiUrl: string;
  token: string;
  /** Storage bucket for the current API base (e.g. production / staging / local). */
  scope: string;
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

export function isTrialEnv(): boolean {
  return getMiniProgramEnvVersion() === "trial";
}

/** True when running inside WeChat DevTools simulator (platform === devtools). */
export function isDevtoolsSimulator(): boolean {
  try {
    const platform = wx.getSystemInfoSync().platform;
    return typeof platform === "string" && platform.toLowerCase() === "devtools";
  } catch {
    return false;
  }
}

/** Fixed API base for the current WeChat build (develop / trial / release). */
export function getBuiltInApiUrl(): string {
  if (isDevelopEnv()) {
    return isDevtoolsSimulator() ? LOCAL_API_URL : STAGING_API_URL;
  }
  if (isTrialEnv()) {
    return STAGING_API_URL;
  }
  return PRODUCTION_API_URL;
}

export function getDefaultApiUrl(): string {
  return getBuiltInApiUrl();
}

function normalizeApiUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim().replace(/\/$/, "");
  if (trimmed === LEGACY_PRODUCTION_API_URL) {
    return PRODUCTION_API_URL;
  }
  return trimmed;
}

/** trial/release 写入 storage 的固定远程地址；develop 模拟器不继承 staging/production。 */
export function isCanonicalRemoteApiUrl(apiUrl: string): boolean {
  const url = normalizeApiUrl(apiUrl);
  return url === PRODUCTION_API_URL || url === STAGING_API_URL;
}

function resolveDevelopApiUrl(): string {
  if (!isDevtoolsSimulator()) {
    return STAGING_API_URL;
  }
  const stored = readStorageString(STORAGE_API_URL);
  if (!stored || isCanonicalRemoteApiUrl(stored)) {
    return LOCAL_API_URL;
  }
  return stored;
}

/** Stable storage bucket per API base so trial/release/develop do not share tokens. */
export function getStorageScope(apiUrl: string): string {
  const url = normalizeApiUrl(apiUrl);
  if (!url || url === PRODUCTION_API_URL) {
    return "production";
  }
  if (url === STAGING_API_URL) {
    return "staging";
  }
  if (url === LOCAL_API_URL) {
    return "local";
  }
  const hostMatch = url.match(/^https?:\/\/([^/]+)/i);
  return hostMatch ? `host:${hostMatch[1]}` : "custom";
}

function scopedStorageKey(base: string, scope: string): string {
  return `${base}:${scope}`;
}

function tokenStorageKey(scope: string): string {
  return scopedStorageKey("token", scope);
}

function readStorageString(key: string): string {
  const value = wx.getStorageSync(key);
  return typeof value === "string" ? value : "";
}

export function getEffectiveApiUrl(): string {
  if (isDevelopEnv()) {
    return resolveDevelopApiUrl();
  }
  return getBuiltInApiUrl();
}

function migrateLegacyStorage(apiUrl: string): void {
  const scope = getStorageScope(apiUrl);
  const legacyApiUrl = readStorageString(STORAGE_API_URL);
  const legacyScope = legacyApiUrl ? getStorageScope(legacyApiUrl) : scope;

  const legacyToken = readStorageString(LEGACY_STORAGE_TOKEN);
  const scopedTokenKey = tokenStorageKey(scope);
  if (legacyToken && !readStorageString(scopedTokenKey) && legacyScope === scope) {
    wx.setStorageSync(scopedTokenKey, legacyToken);
  }
  if (legacyToken) {
    wx.removeStorageSync(LEGACY_STORAGE_TOKEN);
  }

  const legacyPrivacy = readStorageString("privacyConsentVersion");
  const scopedPrivacyKey = scopedStorageKey("privacyConsentVersion", scope);
  if (legacyPrivacy && readStorageString(scopedPrivacyKey) !== legacyPrivacy && legacyScope === scope) {
    wx.setStorageSync(scopedPrivacyKey, legacyPrivacy);
  }
  if (legacyPrivacy) {
    wx.removeStorageSync("privacyConsentVersion");
  }

  const legacyProfilePrefix = `${PROFILE_SETUP_PREFIX}`;
  try {
    const info = wx.getStorageInfoSync();
    for (const key of info.keys) {
      if (!key.startsWith(legacyProfilePrefix)) {
        continue;
      }
      const suffix = key.slice(legacyProfilePrefix.length);
      if (!suffix || suffix.includes(":")) {
        continue;
      }
      const scopedKey = `${PROFILE_SETUP_PREFIX}${scope}:${suffix}`;
      if (!readStorageString(scopedKey)) {
        wx.setStorageSync(scopedKey, readStorageString(key));
      }
      wx.removeStorageSync(key);
    }
  } catch {
    // ignore migration errors
  }
}

/** Align apiUrl with the current WeChat build and migrate legacy flat storage keys. */
export function syncRuntimeConfig(): AppConfig {
  const apiUrl = isDevelopEnv() ? resolveDevelopApiUrl() : getBuiltInApiUrl();
  wx.setStorageSync(STORAGE_API_URL, apiUrl);
  migrateLegacyStorage(apiUrl);
  const scope = getStorageScope(apiUrl);
  return {
    apiUrl,
    scope,
    token: readStorageString(tokenStorageKey(scope))
  };
}

export function getConfig(): AppConfig {
  const apiUrl = getEffectiveApiUrl();
  const scope = getStorageScope(apiUrl);
  return {
    apiUrl,
    scope,
    token: readStorageString(tokenStorageKey(scope))
  };
}

export function saveConfig(patch: Partial<AppConfig>): void {
  const current = getConfig();
  const apiUrl =
    patch.apiUrl !== undefined
      ? isDevelopEnv() && isDevtoolsSimulator()
        ? patch.apiUrl.trim()
        : getBuiltInApiUrl()
      : current.apiUrl;
  if (patch.apiUrl !== undefined) {
    wx.setStorageSync(STORAGE_API_URL, apiUrl);
  }
  if (patch.token !== undefined) {
    const scope = getStorageScope(apiUrl);
    wx.setStorageSync(tokenStorageKey(scope), patch.token.trim());
  }
}

export function clearToken(): void {
  const { scope } = getConfig();
  wx.removeStorageSync(tokenStorageKey(scope));
}

export function hasSeenProfileSetup(userId: string): boolean {
  const { scope } = getConfig();
  return wx.getStorageSync(`${PROFILE_SETUP_PREFIX}${scope}:${userId}`) === "1";
}

export function markProfileSetupSeen(userId: string): void {
  const { scope } = getConfig();
  wx.setStorageSync(`${PROFILE_SETUP_PREFIX}${scope}:${userId}`, "1");
}

export function clearProfileSetupSeen(userId: string): void {
  const { scope } = getConfig();
  wx.removeStorageSync(`${PROFILE_SETUP_PREFIX}${scope}:${userId}`);
}

const SCOPE_LABELS: Record<string, string> = {
  production: "生产 API",
  staging: "预发布 API",
  local: "本地 API"
};

const BUILD_LABELS: Record<string, string> = {
  develop: "开发版",
  trial: "体验版",
  release: "正式版"
};

export function getApiEnvironmentLabel(apiUrl?: string): string {
  const url = apiUrl || getEffectiveApiUrl();
  const scope = getStorageScope(url);
  const scopeLabel = SCOPE_LABELS[scope] || scope;
  const envVersion = getMiniProgramEnvVersion();
  const buildLabel = BUILD_LABELS[envVersion] || envVersion;
  if (isDevelopEnv() && !isDevtoolsSimulator()) {
    return `${buildLabel}（预览/真机） · ${scopeLabel}`;
  }
  return `${buildLabel} · ${scopeLabel}`;
}
