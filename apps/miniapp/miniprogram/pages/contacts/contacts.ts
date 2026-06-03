import { searchContacts } from "../../lib/api";
import type { ContactSummary } from "../../lib/api";
import { avatarColor, getInitial } from "../../lib/format";
import { updateTabBarSelected } from "../../lib/tab-bar";

interface ContactView extends ContactSummary {
  subtitle: string;
  initial: string;
  avatarColor: string;
}

Page({
  data: {
    query: "",
    loading: false,
    loaded: false,
    error: "",
    items: [] as ContactView[]
  },

  onShow() {
    updateTabBarSelected(2);
    this.loadContacts();
  },

  onPullDownRefresh() {
    this.loadContacts(this.data.query.trim()).finally(() => wx.stopPullDownRefresh());
  },

  onQueryInput(e: { detail: { value: string } }) {
    this.setData({ query: e.detail.value });
  },

  onSearch() {
    this.loadContacts(this.data.query.trim());
  },

  onClearSearch() {
    this.setData({ query: "" });
    this.loadContacts();
  },

  loadContacts(query?: string) {
    this.setData({ loading: true, error: "" });
    return searchContacts(query)
      .then((response) => {
        if (!response.ok || !response.data) {
          this.setData({
            loading: false,
            loaded: true,
            error: response.error?.message || "加载失败"
          });
          return;
        }
        this.setData({
          loading: false,
          loaded: true,
          items: response.data.items.map((item) => ({
            ...item,
            subtitle: [item.primaryEmail, item.primaryPhone, item.company]
              .filter(Boolean)
              .join(" · "),
            initial: getInitial(item.displayName),
            avatarColor: avatarColor(item.displayName)
          }))
        });
      })
      .catch(() => {
        this.setData({ loading: false, loaded: true, error: "无法连接 API" });
      });
  },

  onTapContact(e: { currentTarget: { dataset: { item: ContactSummary } } }) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: item.displayName,
      content: [item.primaryEmail, item.primaryPhone].filter(Boolean).join("\n") || "暂无联系方式",
      showCancel: false
    });
  },

  noop() {}
});
