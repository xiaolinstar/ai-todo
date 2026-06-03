import { deleteContact, searchContacts } from "../../lib/api";
import type { ContactSummary } from "../../lib/api";
import {
  buildContactSubtitle,
  loadContentPrefs,
  sortContacts
} from "../../lib/content-prefs";
import { avatarColor, getInitial } from "../../lib/format";
import { SwipeListGesture, withSwipeRow, type SwipeListRowState } from "../../lib/swipe-list";
import { updateTabBarSelected } from "../../lib/tab-bar";

interface ContactView extends ContactSummary, SwipeListRowState {
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

  _swipeList: null as SwipeListGesture<ContactView> | null,

  onLoad() {
    this._swipeList = new SwipeListGesture<ContactView>({
      getItems: () => this.data.items,
      setItems: (items) => this.setData({ items }),
      isDisabled: (item) => item.deleting || item.exiting,
      getDeleteModal: (item) => ({
        title: "删除联系人",
        content: `确定删除“${item.displayName}”？`
      }),
      requestDelete: async (id) => {
        const response = await deleteContact(id);
        return {
          ok: Boolean(response.ok),
          message: response.error?.message
        };
      },
      openEdit: (id) => {
        wx.navigateTo({ url: `/pages/contact-edit/contact-edit?id=${encodeURIComponent(id)}` });
      }
    });
    this._swipeList.updateDeleteActionWidth();
  },

  onShow() {
    updateTabBarSelected(2);
    this._swipeList?.updateDeleteActionWidth();
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
    return Promise.all([searchContacts(query), loadContentPrefs()])
      .then(([response, prefs]) => {
        if (!response.ok || !response.data) {
          this.setData({
            loading: false,
            loaded: true,
            error: response.error?.message || "加载失败"
          });
          return;
        }
        const sorted = sortContacts(response.data.items, prefs.contacts.sortMode);
        this.setData({
          loading: false,
          loaded: true,
          items: sorted.map((item) =>
            withSwipeRow({
              ...item,
              subtitle: buildContactSubtitle(item, prefs.contacts),
              initial: getInitial(item.displayName),
              avatarColor: avatarColor(item.displayName)
            })
          )
        });
      })
      .catch(() => {
        this.setData({ loading: false, loaded: true, error: "无法连接 API" });
      });
  },

  onRowTouchStart(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }) {
    this._swipeList?.onRowTouchStart(e);
  },

  onSwipeMove(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }) {
    this._swipeList?.onSwipeMove(e);
  },

  onRowTouchEnd(e: {
    currentTarget: { dataset: { id: string } };
    changedTouches?: Array<{ clientX: number; clientY: number }>;
  }) {
    this._swipeList?.onRowTouchEnd(e);
  },

  onDeleteTap(e: { currentTarget: { dataset: { id: string } } }) {
    this._swipeList?.onDeleteTap(e);
  }
});
