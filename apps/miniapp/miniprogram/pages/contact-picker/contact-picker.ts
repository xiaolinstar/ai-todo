import { searchContacts, type ContactSummary } from "../../lib/api";

interface ContactView extends ContactSummary {
  subtitle: string;
}

Page({
  data: {
    query: "",
    loading: false,
    error: "",
    items: [] as ContactView[]
  },

  onLoad() {
    this.loadContacts();
  },

  onQueryInput(e: { detail: { value: string } }) {
    this.setData({ query: e.detail.value });
  },

  onSearch() {
    this.loadContacts(this.data.query.trim());
  },

  loadContacts(query?: string) {
    this.setData({ loading: true, error: "" });
    return searchContacts(query)
      .then((response) => {
        if (!response.ok || !response.data) {
          this.setData({
            loading: false,
            error: response.error?.message || "加载失败"
          });
          return;
        }
        this.setData({
          loading: false,
          items: response.data.items.map((item) => ({
            ...item,
            subtitle: [item.primaryEmail, item.primaryPhone, item.company]
              .filter(Boolean)
              .join(" · ")
          }))
        });
      })
      .catch(() => {
        this.setData({ loading: false, error: "无法连接 API" });
      });
  },

  onSelect(e: { currentTarget: { dataset: { item: ContactSummary } } }) {
    const item = e.currentTarget.dataset.item;
    const page = this as unknown as {
      getOpenerEventChannel(): { emit: (name: string, data: unknown) => void };
    };
    page.getOpenerEventChannel().emit("selectContact", item);
    wx.navigateBack();
  }
});
