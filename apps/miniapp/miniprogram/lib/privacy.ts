export function requirePrivacyAuthorization(): Promise<boolean> {
  const requirePrivacyAuthorize = wx.requirePrivacyAuthorize;
  if (!requirePrivacyAuthorize) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    requirePrivacyAuthorize({
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}
