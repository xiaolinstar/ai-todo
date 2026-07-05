import { deleteTag, fetchTags, updateTag, type TagSummary } from '../../lib/api';
import { TODO_MODAL_CONFIRM_DANGER, TODO_TAG_PALETTE } from '../../lib/design-tokens';

Page({
  data: {
    loading: true,
    saving: false,
    deleting: false,
    tagId: '',
    originalName: '',
    originalColor: TODO_TAG_PALETTE[0],
    name: '',
    color: TODO_TAG_PALETTE[0],
    usageCount: 0,
    palette: [...TODO_TAG_PALETTE],
  },

  onLoad(options: { id?: string }) {
    const tagId = (options?.id || '').trim();
    if (!tagId) {
      wx.showToast({ title: '标签不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }
    this.setData({ tagId });
    this.loadTag();
  },

  loadTag() {
    this.setData({ loading: true });
    fetchTags({ limit: 50 })
      .then((response) => {
        if (!response.ok || !response.data) {
          this.setData({ loading: false });
          wx.showToast({ title: response.error?.message || '加载失败', icon: 'none' });
          return;
        }
        const tag = response.data.items.find((item: TagSummary) => item.id === this.data.tagId);
        if (!tag) {
          this.setData({ loading: false });
          wx.showToast({ title: '标签不存在', icon: 'none' });
          wx.navigateBack();
          return;
        }
        this.setData({
          loading: false,
          originalName: tag.name,
          originalColor: tag.color,
          name: tag.name,
          color: tag.color,
          usageCount: tag.usageCount || 0,
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  onNameInput(e: { detail: { value: string } }) {
    this.setData({ name: e.detail.value });
  },

  onColorTap(e: { currentTarget: { dataset: { color?: string } } }) {
    const color = e.currentTarget.dataset.color;
    if (color) this.setData({ color });
  },

  onSave() {
    const name = this.data.name.trim();
    if (!name) {
      wx.showToast({ title: '请输入标签名称', icon: 'none' });
      return;
    }
    const patch: { name?: string; color?: string } = {};
    if (name !== this.data.originalName) patch.name = name;
    if (this.data.color !== this.data.originalColor) patch.color = this.data.color;
    if (!patch.name && !patch.color) {
      wx.navigateBack();
      return;
    }
    this.setData({ saving: true });
    updateTag(this.data.tagId, patch)
      .then((response) => {
        this.setData({ saving: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || '保存失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '已保存', icon: 'success' });
        wx.navigateBack();
      })
      .catch(() => {
        this.setData({ saving: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  onDelete() {
    wx.showModal({
      title: '删除标签',
      content: `删除「${this.data.originalName || '标签'}」会从相关提醒中移除该标签。`,
      confirmText: '删除',
      confirmColor: TODO_MODAL_CONFIRM_DANGER,
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ deleting: true });
        deleteTag(this.data.tagId)
          .then((response) => {
            this.setData({ deleting: false });
            if (!response.ok) {
              wx.showToast({ title: response.error?.message || '删除失败', icon: 'none' });
              return;
            }
            wx.showToast({ title: '已删除', icon: 'success' });
            wx.navigateBack();
          })
          .catch(() => {
            this.setData({ deleting: false });
            wx.showToast({ title: '网络错误', icon: 'none' });
          });
      },
    });
  },
});
