Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    onOpenContract() {
      if (!wx.openPrivacyContract) {
        wx.showToast({ title: "请在微信中查看隐私指引", icon: "none" });
        return;
      }
      wx.openPrivacyContract({
        fail: (err) => {
          console.warn("openPrivacyContract failed", err);
          wx.showToast({ title: "隐私指引暂未生效", icon: "none" });
        }
      });
    },

    onAgree() {
      (this as any).triggerEvent("agree");
    },

    onDisagree() {
      (this as any).triggerEvent("disagree");
    }
  }
});
