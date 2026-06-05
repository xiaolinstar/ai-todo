import { clearToken } from "../../lib/config";

Page({
  onOpenAgent() {
    wx.navigateTo({ url: "/pages/settings-agent/settings-agent" });
  },

  onLogout() {
    wx.showModal({
      title: "退出登录",
      content: "退出后需重新微信登录。",
      success: (result) => {
        if (!result.confirm) return;
        clearToken();
        wx.showToast({ title: "已退出", icon: "none" });
        setTimeout(() => {
          wx.navigateBack();
        }, 400);
      }
    });
  }
});
