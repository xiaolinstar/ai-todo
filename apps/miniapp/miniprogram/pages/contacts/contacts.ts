import { createContact, searchContacts, type ContactSummary } from "../../lib/api";
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
    items: [] as ContactView[],
    showAddForm: false,
    newName: "",
    newEmail: "",
    adding: false
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

  showAdd() {
    this.setData({ showAddForm: true, newName: "", newEmail: "" });
  },

  hideAdd() {
    this.setData({ showAddForm: false });
  },

  noop() {},

  onNewNameInput(e: { detail: { value: string } }) {
    this.setData({ newName: e.detail.value });
  },

  onNewEmailInput(e: { detail: { value: string } }) {
    this.setData({ newEmail: e.detail.value });
  },

  onAddContact() {
    const displayName = this.data.newName.trim();
    if (!displayName) {
      wx.showToast({ title: "请输入姓名", icon: "none" });
      return;
    }

    const methods: Array<{ type: string; value: string; isPrimary?: boolean }> = [];
    const email = this.data.newEmail.trim();
    if (email) {
      methods.push({ type: "email", value: email, isPrimary: true });
    }

    this.setData({ adding: true });
    createContact({ displayName, methods })
      .then((response) => {
        this.setData({ adding: false });
        if (!response.ok) {
          wx.showToast({ title: response.error?.message || "添加失败", icon: "none" });
          return;
        }
        wx.showToast({ title: "已添加", icon: "success" });
        this.setData({ showAddForm: false });
        this.loadContacts();
      })
      .catch(() => {
        this.setData({ adding: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
