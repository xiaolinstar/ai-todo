import { createTag, deleteTag, fetchTags, updateTag, type TagSummary } from '../../lib/api';
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

  onColorTap(e: { currentTarget: { dataset: { id?: string; color?: string } } }) {
    const { id, color } = e.currentTarget.dataset;
    if (!id || !color) return;
    this.patchTag(id, { color });
  },

  onNameBlur(e: { currentTarget: { dataset: { id?: string } }; detail: { value: string } }) {
    this.renameTag(e.currentTarget.dataset.id, e.detail.value);
  },

  onNameConfirm(e: { currentTarget: { dataset: { id?: string } }; detail: { value: string } }) {
    this.renameTag(e.currentTarget.dataset.id, e.detail.value);
  },

  renameTag(id: string | undefined, value: string) {
    const name = value.trim();
    if (!id || !name) return;
    const existing = (this.data.tags as TagSummary[]).find((tag: TagSummary) => tag.id === id);
    if (existing && existing.name === name) return;
    this.patchTag(id, { name });
  },

  patchTag(id: string, patch: { name?: string; color?: string }) {
    updateTag(id, patch)
      .then((response) => {
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || '保存失败', icon: 'none' });
          this.loadTags();
          return;
        }
        this.setData({ tags: mergeTag(this.data.tags, response.data.tag) });
      })
      .catch(() => {
        wx.showToast({ title: '网络错误', icon: 'none' });
        this.loadTags();
      });
  },

  onDeleteTag(e: { currentTarget: { dataset: { id?: string; name?: string } } }) {
    const { id, name } = e.currentTarget.dataset;
    if (!id) return;
    wx.showModal({
      title: '删除标签',
      content: `删除「${name || '标签'}」会从相关提醒中移除该标签。`,
      confirmText: '删除',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (!res.confirm) return;
        deleteTag(id)
          .then((response) => {
            if (!response.ok) {
              wx.showToast({ title: response.error?.message || '删除失败', icon: 'none' });
              return;
            }
            this.setData({
              tags: (this.data.tags as TagSummary[]).filter((tag: TagSummary) => tag.id !== id),
            });
            wx.showToast({ title: '已删除', icon: 'success' });
          })
          .catch(() => wx.showToast({ title: '网络错误', icon: 'none' }));
      },
    });
  },
});

function mergeTag(tags: TagSummary[], next: TagSummary): TagSummary[] {
  const found = tags.some((tag) => tag.id === next.id);
  const merged = found ? tags.map((tag) => (tag.id === next.id ? next : tag)) : [...tags, next];
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}
