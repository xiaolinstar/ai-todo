import { createTag, fetchTags, type TagSummary } from '../../lib/api';
import { TODO_TAG_PALETTE } from '../../lib/design-tokens';

Page({
  data: {
    loading: true,
    creating: false,
    tags: [] as TagSummary[],
    palette: [...TODO_TAG_PALETTE],
    newName: '',
    newColor: TODO_TAG_PALETTE[0],
  },

  onShow() {
    this.loadTags();
  },

  loadTags() {
    this.setData({ loading: true });
    fetchTags({ limit: 10 })
      .then((response) => {
        this.setData({
          loading: false,
          tags: response.ok && response.data ? response.data.items : [],
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  onNewNameInput(e: { detail: { value: string } }) {
    this.setData({ newName: e.detail.value });
  },

  onNewColorTap(e: { currentTarget: { dataset: { color?: string } } }) {
    const color = e.currentTarget.dataset.color;
    if (color) this.setData({ newColor: color });
  },

  onCreateTag() {
    const name = this.data.newName.trim();
    if (!name) {
      wx.showToast({ title: '请输入标签名称', icon: 'none' });
      return;
    }
    this.setData({ creating: true });
    createTag({ name, color: this.data.newColor })
      .then((response) => {
        this.setData({ creating: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || '新增失败', icon: 'none' });
          return;
        }
        this.setData({
          newName: '',
          tags: mergeTag(this.data.tags, response.data.tag),
        });
        wx.showToast({ title: '已新增', icon: 'success' });
      })
      .catch(() => {
        this.setData({ creating: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  onTagTap(e: { currentTarget: { dataset: { id?: string } } }) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/settings-tag-detail/settings-tag-detail?id=${encodeURIComponent(id)}`,
    });
  },
});

function mergeTag(tags: TagSummary[], next: TagSummary): TagSummary[] {
  const found = tags.some((tag) => tag.id === next.id);
  const merged = found ? tags.map((tag) => (tag.id === next.id ? next : tag)) : [...tags, next];
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}
