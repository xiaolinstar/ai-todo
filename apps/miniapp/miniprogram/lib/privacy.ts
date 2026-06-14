/** Keep in sync with docs/privacy-compliance.md (latest approved version). */
import { getConfig } from "./config";

export const PRIVACY_POLICY_VERSION = "2026-06-07";

function privacyConsentKey(): string {
  return `privacyConsentVersion:${getConfig().scope}`;
}

export function hasPrivacyConsent(): boolean {
  try {
    return wx.getStorageSync(privacyConsentKey()) === PRIVACY_POLICY_VERSION;
  } catch {
    return false;
  }
}

export function markPrivacyConsented(): void {
  wx.setStorageSync(privacyConsentKey(), PRIVACY_POLICY_VERSION);
}

export function clearPrivacyConsent(): void {
  wx.removeStorageSync(privacyConsentKey());
}

export function requirePrivacyAuthorization(): Promise<boolean> {
  if (hasPrivacyConsent()) {
    return Promise.resolve(true);
  }

  const requirePrivacyAuthorize = wx.requirePrivacyAuthorize;
  if (!requirePrivacyAuthorize) {
    markPrivacyConsented();
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    requirePrivacyAuthorize({
      success: () => {
        markPrivacyConsented();
        resolve(true);
      },
      fail: () => resolve(false)
    });
  });
}
