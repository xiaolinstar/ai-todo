/** Keep in sync with docs/privacy-compliance.md (latest approved version). */
export const PRIVACY_POLICY_VERSION = "2026-06-07";

const STORAGE_PRIVACY_CONSENT = "privacyConsentVersion";

export function hasPrivacyConsent(): boolean {
  try {
    return wx.getStorageSync(STORAGE_PRIVACY_CONSENT) === PRIVACY_POLICY_VERSION;
  } catch {
    return false;
  }
}

export function markPrivacyConsented(): void {
  wx.setStorageSync(STORAGE_PRIVACY_CONSENT, PRIVACY_POLICY_VERSION);
}

export function clearPrivacyConsent(): void {
  wx.removeStorageSync(STORAGE_PRIVACY_CONSENT);
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
