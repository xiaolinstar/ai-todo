type TabBarInstance = {
  data: { selected: number };
  setData: (data: { selected: number }) => void;
  syncSelectedFromRoute: () => void;
};

function asTabBar(ctx: unknown): TabBarInstance {
  return ctx as TabBarInstance;
}

Component({
  data: {
    selected: 0
  },

  lifetimes: {
    attached() {
      asTabBar(this).syncSelectedFromRoute();
    }
  },

  pageLifetimes: {
    show() {
      asTabBar(this).syncSelectedFromRoute();
    }
  },

  methods: {
    syncSelectedFromRoute() {
      const self = asTabBar(this);
      const pages = getCurrentPages();
      const current = pages[pages.length - 1] as { route?: string } | undefined;
      const route = current?.route || "";
      const indexMap: Record<string, number> = {
        "pages/todos/todos": 0,
        "pages/calendar/calendar": 1,
        "pages/contacts/contacts": 2,
        "pages/mine/mine": 3
      };
      const selected = indexMap[route];
      if (selected !== undefined && selected !== self.data.selected) {
        self.setData({ selected });
      }
    },

    switchTab(e: { currentTarget: { dataset: { index: string } } }) {
      const self = asTabBar(this);
      const index = Number(e.currentTarget.dataset.index);
      if (Number.isNaN(index) || index === self.data.selected) return;

      const pages = [
        "/pages/todos/todos",
        "/pages/calendar/calendar",
        "/pages/contacts/contacts",
        "/pages/mine/mine"
      ];

      wx.switchTab({ url: pages[index] });
      self.setData({ selected: index });
    },

    onCreateTap() {
      wx.showActionSheet({
        itemList: ["新建提醒", "新建日程", "添加联系人"],
        success: (res) => {
          if (res.tapIndex === 0) {
            wx.navigateTo({ url: "/pages/reminder-create/reminder-create" });
            return;
          }
          if (res.tapIndex === 1) {
            wx.navigateTo({ url: "/pages/event-create/event-create" });
            return;
          }
          if (res.tapIndex === 2) {
            wx.switchTab({
              url: "/pages/contacts/contacts",
              success: () => {
                setTimeout(() => {
                  const pages = getCurrentPages();
                  const contactsPage = pages[pages.length - 1] as {
                    showAdd?: () => void;
                  };
                  contactsPage.showAdd?.();
                }, 120);
              }
            });
          }
        }
      });
    }
  }
});
