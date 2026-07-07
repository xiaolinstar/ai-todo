import { createTag, fetchTags, type TagSummary } from '../../lib/api';
import { TODO_TAG_PALETTE } from '../../lib/design-tokens';
import { withTagStyle, type TagStyleFields } from '../../lib/tag-style';

type TagSort = 'usage' | 'name' | 'updated';

interface DecoratedTag extends TagSummary, TagStyleFields {
  usageLabel: string;
  lastUsedLabel: string;
  stateLabel: string;
  stateClass: string;
}

interface PalettePreviewItem {
  color: string;
  count: number;
}

Page({
  data: {
    loading: true,
    creating: false,
    tags: [] as DecoratedTag[],
    palette: [...TODO_TAG_PALETTE],
    palettePreview: [] as PalettePreviewItem[],
    totalCount: 0,
    usedCount: 0,
    unusedCount: 0,
    newName: '',
    newColor: TODO_TAG_PALETTE[0],
    query: '',
    sort: 'usage' as TagSort,
  },

  onShow() {
    this.loadTags();
  },

  loadTags() {
    this.setData({ loading: true });
    fetchTags({ limit: 50, q: this.data.query, sort: this.data.sort })
      .then((response) => {
        const tags = response.ok && response.data ? decorateTags(response.data.items) : [];
        this.setData({
          loading: false,
          tags,
          ...summarizeTags(tags),
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

  onQueryInput(e: { detail: { value: string } }) {
    this.setData({ query: e.detail.value });
    this.loadTags();
  },

  onClearSearch() {
    this.setData({ query: '' });
    this.loadTags();
  },

  onSortTap(e: { currentTarget: { dataset: { sort?: TagSort } } }) {
    const sort = e.currentTarget.dataset.sort;
    if (!sort || sort === this.data.sort) return;
    this.setData({ sort });
    this.loadTags();
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
          ...applyTagListState(decorateTags(mergeTag(this.data.tags, response.data.tag))),
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

function decorateTags(tags: TagSummary[]): DecoratedTag[] {
  return tags.map((tag) => ({
    ...withTagStyle(tag),
    usageLabel: `${tag.usageCount || 0} 个提醒`,
    lastUsedLabel: tag.lastUsedAt ? `最近使用 ${formatDate(tag.lastUsedAt)}` : '未使用',
    stateLabel: tag.usageCount ? '使用中' : '未使用',
    stateClass: tag.usageCount ? 'active' : 'idle',
  }));
}

function summarizeTags(tags: TagSummary[]) {
  const usedCount = tags.filter((tag) => (tag.usageCount || 0) > 0).length;
  return {
    totalCount: tags.length,
    usedCount,
    unusedCount: Math.max(tags.length - usedCount, 0),
    palettePreview: buildPalettePreview(tags),
  };
}

function applyTagListState(tags: DecoratedTag[]) {
  return {
    tags,
    ...summarizeTags(tags),
  };
}

function buildPalettePreview(tags: TagSummary[]): PalettePreviewItem[] {
  const counts = new Map<string, number>();
  for (const tag of tags) {
    counts.set(tag.color, (counts.get(tag.color) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || paletteOrder(a[0]) - paletteOrder(b[0]))
    .slice(0, 8)
    .map(([color, count]) => ({ color, count }));
}

function paletteOrder(color: string): number {
  const index = (TODO_TAG_PALETTE as readonly string[]).indexOf(color);
  return index >= 0 ? index : TODO_TAG_PALETTE.length;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${month}-${day}`;
}
