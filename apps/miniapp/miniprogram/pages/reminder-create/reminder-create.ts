import { handleApiError } from '../../lib/error-handler';
import { loadAccountDay } from '../../lib/account-day';
import { createReminder, createTag, fetchTags } from '../../lib/api';
import type { ContactSummary, TagSummary } from '../../lib/api';
import { combineDateTime } from '../../lib/format';
import { todoPageThemeData } from '../../lib/theme';
import { loadWechatNotificationPrefs, requestReminderNotification } from '../../lib/wechat-notify';

interface TagOption extends TagSummary {
  selected: boolean;
}

Page({
  data: {
    ...todoPageThemeData(),
    title: '',
    notes: '',
    notesExpanded: false,
    selectedTags: [] as TagSummary[],
    allTagOptions: [] as TagSummary[],
    tagOptions: [] as TagOption[],
    tagInput: '',
    tagCreating: false,
    hasDue: false,
    dueDate: '',
    dueTime: '',
    notifyEnabled: true,
    notifyAvailable: false,
    reminderTemplateId: '',
    selectedContact: null as ContactSummary | null,
    accountTimezone: '',
    submitting: false,
  },

  onLoad() {
    loadAccountDay().then(({ today, timezone, nowTime }) => {
      this.setData({
        accountTimezone: timezone,
        dueDate: today,
        dueTime: nowTime,
      });
    });
    loadWechatNotificationPrefs().then((prefs) => {
      this.setData({
        notifyAvailable: prefs.notifyAvailable,
        notifyEnabled: prefs.notifyEnabled,
        reminderTemplateId: prefs.reminderTemplateId,
      });
    });
    this.loadTagOptions();
  },

  onTitleInput(e: { detail: { value: string } }) {
    this.setData({ title: e.detail.value });
  },

  onNotesInput(e: { detail: { value: string } }) {
    this.setData({ notes: e.detail.value });
  },

  toggleNotes() {
    this.setData({ notesExpanded: !this.data.notesExpanded });
  },

  loadTagOptions() {
    fetchTags({ limit: 50 }).then((response) => {
      if (!response.ok || !response.data) {
        return;
      }
      this.setData({
        allTagOptions: response.data.items,
        tagOptions: markTagOptions(
          filterTagOptions(response.data.items, this.data.selectedTags, ''),
          this.data.selectedTags,
        ),
      });
    });
  },

  onTagTap(e: { currentTarget: { dataset: { id?: string } } }) {
    const id = e.currentTarget.dataset.id || '';
    if (!id) return;
    const selectedTags = this.data.selectedTags as TagSummary[];
    const existing = selectedTags.find((tag) => tag.id === id);
    if (existing) {
      const nextSelected = selectedTags.filter((tag) => tag.id !== id);
      this.setData({
        selectedTags: nextSelected,
        tagOptions: markTagOptions(
          filterTagOptions(this.data.allTagOptions, nextSelected, this.data.tagInput),
          nextSelected,
        ),
      });
      return;
    }
    if (selectedTags.length >= 5) {
      wx.showToast({ title: '每条提醒最多 5 个标签', icon: 'none' });
      return;
    }
    const picked = (this.data.tagOptions as TagOption[]).find((tag) => tag.id === id);
    if (!picked) return;
    const nextSelected = [...selectedTags, toTagSummary(picked)];
    this.setData({
      selectedTags: nextSelected,
      tagOptions: markTagOptions(
        filterTagOptions(this.data.allTagOptions, nextSelected, this.data.tagInput),
        nextSelected,
      ),
    });
  },

  onTagInput(e: { detail: { value: string } }) {
    const tagInput = e.detail.value;
    this.setData({
      tagInput,
      tagOptions: markTagOptions(
        filterTagOptions(this.data.allTagOptions, this.data.selectedTags, tagInput),
        this.data.selectedTags,
      ),
    });
  },

  onCreateTagFromInput() {
    const name = this.data.tagInput.trim();
    if (!name) {
      wx.showToast({ title: '请输入标签名称', icon: 'none' });
      return;
    }
    if (this.data.selectedTags.length >= 5) {
      wx.showToast({ title: '每条提醒最多 5 个标签', icon: 'none' });
      return;
    }
    this.setData({ tagCreating: true });
    createTag({ name })
      .then((response) => {
        this.setData({ tagCreating: false });
        if (!response.ok || !response.data) {
          handleApiError(response.error, '创建标签失败');
          return;
        }
        const tag = response.data.tag;
        const selectedTags = mergeSelectedTag(this.data.selectedTags, tag);
        const allTagOptions = mergeTagOptions(this.data.allTagOptions, [tag]);
        this.setData({
          tagInput: '',
          allTagOptions,
          selectedTags,
          tagOptions: markTagOptions(
            filterTagOptions(allTagOptions, selectedTags, ''),
            selectedTags,
          ),
        });
      })
      .catch(() => {
        this.setData({ tagCreating: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  onDueToggle(e: { detail: { value: boolean } }) {
    this.setData({ hasDue: e.detail.value });
  },

  onNotifyToggle(e: { detail: { value: boolean } }) {
    this.setData({ notifyEnabled: e.detail.value });
  },

  onDateChange(e: { detail: { value: string } }) {
    this.setData({ dueDate: e.detail.value });
  },

  onTimeChange(e: { detail: { value: string } }) {
    this.setData({ dueTime: e.detail.value });
  },

  pickContact() {
    wx.navigateTo({
      url: '/pages/contact-picker/contact-picker',
      events: {
        selectContact: (data: unknown) => {
          this.setData({ selectedContact: data as ContactSummary });
        },
      },
    });
  },

  clearContact() {
    this.setData({ selectedContact: null });
  },

  onSubmit() {
    const title = this.data.title.trim();
    if (!title) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }

    const payload: {
      title: string;
      notes?: string;
      dueAt?: string;
      wechatNotifyRequested?: boolean;
      contactIds?: string[];
      tagNames?: string[];
    } = {
      title,
      wechatNotifyRequested:
        this.data.hasDue && this.data.notifyAvailable && this.data.notifyEnabled,
    };
    const notes = this.data.notes.trim();
    if (notes) {
      payload.notes = notes;
    }
    if (this.data.selectedTags.length > 0) {
      payload.tagNames = this.data.selectedTags.map((tag: TagSummary) => tag.name);
    }
    if (this.data.hasDue) {
      payload.dueAt = combineDateTime(
        this.data.dueDate,
        this.data.dueTime,
        this.data.accountTimezone || undefined,
      );
    }
    if (this.data.selectedContact) {
      payload.contactIds = [this.data.selectedContact.id];
    }

    this.setData({ submitting: true });
    createReminder(payload)
      .then(async (response) => {
        this.setData({ submitting: false });
        if (!response.ok) {
          handleApiError(response.error, '创建失败');
          return;
        }
        await this.notifyAfterSave(response.data?.reminder.id);
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  async notifyAfterSave(reminderId?: string) {
    const shouldNotify =
      Boolean(reminderId) &&
      this.data.hasDue &&
      this.data.notifyEnabled &&
      this.data.notifyAvailable &&
      Boolean(this.data.reminderTemplateId);

    if (!shouldNotify || !reminderId) {
      wx.showToast({ title: '已创建', icon: 'success' });
      return;
    }

    try {
      const { accepted } = await requestReminderNotification({
        reminderId,
        templateId: this.data.reminderTemplateId,
        enabled: true,
      });
      wx.showToast({
        title: accepted ? '已创建并开启提醒' : '已创建，未开启微信提醒',
        icon: accepted ? 'success' : 'none',
      });
    } catch {
      wx.showToast({ title: '已创建，提醒授权同步失败', icon: 'none' });
    }
  },
});

function markTagOptions(options: TagSummary[], selected: TagSummary[]): TagOption[] {
  const selectedIds = new Set(selected.map((tag) => tag.id));
  return options.map((tag) => ({ ...tag, selected: selectedIds.has(tag.id) }));
}

function mergeTagOptions(options: TagSummary[], selected: TagSummary[]): TagSummary[] {
  const optionIds = new Set(options.map((tag) => tag.id));
  return [...options, ...selected.filter((tag) => !optionIds.has(tag.id))];
}

function mergeSelectedTag(selected: TagSummary[], next: TagSummary): TagSummary[] {
  if (selected.some((tag) => tag.id === next.id)) {
    return selected;
  }
  return [...selected, next];
}

function filterTagOptions(
  options: TagSummary[],
  selected: TagSummary[],
  query: string,
): TagSummary[] {
  const merged = mergeTagOptions(options, selected);
  const cleaned = query.trim().toLowerCase();
  if (!cleaned) {
    return merged;
  }
  return merged.filter((tag) => tag.name.toLowerCase().includes(cleaned));
}

function toTagSummary(tag: TagSummary): TagSummary {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    usageCount: tag.usageCount,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt,
    lastUsedAt: tag.lastUsedAt,
  };
}
