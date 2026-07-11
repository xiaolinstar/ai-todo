import { AuthErrorCode } from './error-codes';
import type { ApiError } from './api';

let isShowingLoginModal = false;

export function handleApiError(error: ApiError | undefined, fallback: string) {
  if (!error) {
    wx.showToast({ title: fallback, icon: 'none' });
    return;
  }
  if (error.code === AuthErrorCode.invalidToken) {
    if (!isShowingLoginModal) {
      isShowingLoginModal = true;
      wx.showModal({
        title: '提示',
        content: error.message || '请先登录后继续使用',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          isShowingLoginModal = false;
          if (res.confirm) {
            wx.switchTab({ url: '/pages/mine/mine' });
          }
        },
      });
    }
    return;
  }
  wx.showToast({ title: error.message || fallback, icon: 'none' });
}
