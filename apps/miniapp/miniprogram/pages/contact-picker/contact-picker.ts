import { searchContacts } from '../../lib/api';
import type { ContactSummary } from '../../lib/api';
import { avatarColor, getInitial } from '../../lib/format';

interface ContactView extends ContactSummary {
  subtitle: string;
  initial: string;
  avatarColor: string;
}

Page({
  data: {
    query: '',
    loading: false,
    loaded: false,
    error: '',
    items: [] as ContactView[],
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

  onClearSearch() {
    this.setData({ query: '' });
    this.loadContacts();
  },

  loadContacts(query?: string) {
    this.setData({ loading: true, error: '' });
    return searchContacts(query)
      .then((response) => {
        if (!response.ok || !response.data) {
          this.setData({
            loading: false,
            loaded: true,
            error: response.error?.message || '加载失败',
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
              .join(' · '),
            initial: getInitial(item.displayName),
            avatarColor: avatarColor(item.displayName),
          })),
        });
      })
      .catch(() => {
        this.setData({ loading: false, loaded: true, error: '无法连接 API' });
      });
  },

  onSelect(e: { currentTarget: { dataset: { item: ContactSummary } } }) {
    const item = e.currentTarget.dataset.item;
    const channel = (
      this as { getOpenerEventChannel(): { emit: (name: string, data: unknown) => void } }
    ).getOpenerEventChannel();
    channel.emit('selectContact', item);
    wx.navigateBack();
  },
});
