import { handleApiError } from '../../lib/error-handler';
import { loadAccountDay } from '../../lib/account-day';
import {
  addReminderTrackEntry,
  createTag,
  fetchReminder,
  fetchTags,
  formatApiErrorMessage,
  updateReminder,
} from '../../lib/api';
import type { ContactSummary, ReminderTrackEntry, TagSummary } from '../../lib/api';
import { combineDateTime, formatTrackDateLabel, splitIsoDateTime } from '../../lib/format';
import { todoPageThemeData } from '../../lib/theme';
import { loadWechatNotificationPrefs, enableWechatNotifyForTarget } from '../../lib/wechat-notify';

interface TagOption extends TagSummary {
  selected: boolean;
}

Page({
  data: {
    ...todoPageThemeData(),
    reminderId: '',
    loading: true,
    isCompleted: false,
    status: 'pending' as 'pending' | 'in_progress' | 'completed',
    title: '',
    titleTextareaHeight: titleTextareaHeight(''),
    notes: '',
    notesExpanded: false,
    selectedTags: [] as TagSummary[],
    allTagOptions: [] as TagSummary[],
    tagOptions: [] as TagOption[],
    tagInput: '',
    tagCreating: false,
    trackEntries: [] as ReminderTrackEntry[],
    trackInput: '',
    trackDatePrefix: '',
    trackSubmitting: false,
    sourceLabel: '',
    hasDue: true,
    dueDate: '',
    dueTime: '',
    notifyAvailable: false,
    notifyEnabled: false,
    reminderTemplateId: '',
    selectedContacts: [] as ContactSummary[],
    contactLabel: '选择',
    accountTimezone: '',
    submitting: false,
  },

  _originalDueAt: '',

  onLoad(options: { id?: string }) {
    const reminderId = (options.id || '').trim();
    if (!reminderId) {
      wx.showToast({ title: '缺少提醒 ID', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ reminderId });
    Promise.all([
      loadAccountDay(),
      fetchReminder(reminderId),
      loadWechatNotificationPrefs(),
      fetchTags({ limit: 50 }),
    ])
      .then(([account, response, prefs, tagsResponse]) => {
        if (!response.ok || !response.data) {
          this.setData({ loading: false });
          handleApiError(response.error, '加载失败');
          return;
        }
        const reminder = response.data.reminder;
        const status = (reminder.status || 'pending') as 'pending' | 'in_progress' | 'completed';
        const isCompleted = status === 'completed';
        const hasDue = Boolean(reminder.dueAt);
        const tz = account.timezone;
        const { date, time } = splitIsoDateTime(reminder.dueAt, tz);
        const selectedTags = reminder.tags || [];
        const tagOptions = mergeTagOptions(
          tagsResponse.ok && tagsResponse.data ? tagsResponse.data.items : [],
          selectedTags,
        );
        this._originalDueAt = reminder.dueAt || '';
        this.setData({
          loading: false,
          accountTimezone: tz,
          status,
          isCompleted,
          title: reminder.title || '',
          titleTextareaHeight: titleTextareaHeight(reminder.title || ''),
          notes: reminder.notes || '',
          notesExpanded: Boolean(
            reminder.notes || (reminder.trackEntries && reminder.trackEntries.length > 0),
          ),
          selectedTags,
          allTagOptions: tagOptions,
          tagOptions: markTagOptions(filterTagOptions(tagOptions, selectedTags, ''), selectedTags),
          trackEntries: reminder.trackEntries || [],
          trackDatePrefix: `${formatTrackDateLabel(tz)} `,
          sourceLabel: formatSourceLabel(reminder.source, reminder.externalId),
          hasDue: isCompleted ? false : hasDue,
          dueDate: date,
          dueTime: time,
          selectedContacts: reminder.contacts || [],
          contactLabel: formatContactLabel(reminder.contacts || []),
          notifyAvailable: prefs.notifyAvailable,
          notifyEnabled: Boolean(reminder.wechatNotifyRequested),
          reminderTemplateId: prefs.reminderTemplateId,
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  onTitleInput(e: { detail: { value: string } }) {
    this.setData({
      title: e.detail.value,
      titleTextareaHeight: titleTextareaHeight(e.detail.value),
    });
  },

  onNotesInput(e: { detail: { value: string } }) {
    this.setData({ notes: e.detail.value });
  },

  toggleNotes() {
    this.setData({ notesExpanded: !this.data.notesExpanded });
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
          wx.showToast({
            title: formatApiErrorMessage(response.error, '创建标签失败'),
            icon: 'none',
          });
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

  onTrackInput(e: { detail: { value: string } }) {
    this.setData({ trackInput: e.detail.value });
  },

  onAddTrackEntry() {
    const text = this.data.trackInput.trim();
    if (!text) {
      wx.showToast({ title: '请输入跟踪内容', icon: 'none' });
      return;
    }
    if (text.length > 30) {
      wx.showToast({ title: '最多 30 字', icon: 'none' });
      return;
    }
    this.setData({ trackSubmitting: true });
    addReminderTrackEntry(this.data.reminderId, text)
      .then((response) => {
        this.setData({ trackSubmitting: false });
        if (!response.ok || !response.data) {
          wx.showToast({
            title: formatApiErrorMessage(response.error, '添加失败'),
            icon: 'none',
          });
          return;
        }
        this.setData({
          trackEntries: response.data.reminder.trackEntries || [],
          trackInput: '',
          trackDatePrefix: `${formatTrackDateLabel(this.data.accountTimezone)} `,
        });
        wx.showToast({ title: '已添加', icon: 'success' });
      })
      .catch(() => {
        this.setData({ trackSubmitting: false });
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
          const contacts = [data as ContactSummary];
          this.setData({
            selectedContacts: contacts,
            contactLabel: formatContactLabel(contacts),
          });
        },
      },
    });
  },

  clearContact() {
    this.setData({
      selectedContacts: [],
      contactLabel: formatContactLabel([]),
    });
  },

  onStatusChange(e: { currentTarget: { dataset: { status: string } } }) {
    const status = e.currentTarget.dataset.status as 'pending' | 'in_progress' | 'completed';
    if (!status || status === this.data.status) return;
    this.setData({
      status,
      isCompleted: status === 'completed',
      hasDue: status === 'completed' ? false : this.data.hasDue,
    });
  },

  onSubmit() {
    const title = this.data.title.trim();
    if (!title) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }

    const payload: {
      title: string;
      notes: string;
      status: string;
      dueAt?: string | null;
      wechatNotifyRequested?: boolean;
      contactIds: string[];
      tagNames: string[];
    } = {
      title,
      notes: this.data.notes.trim(),
      status: this.data.status,
      wechatNotifyRequested: this.data.notifyEnabled,
      contactIds: this.data.selectedContacts.map((contact: ContactSummary) => contact.id),
      tagNames: this.data.selectedTags.map((tag: TagSummary) => tag.name),
    };

    let nextDueAt: string | null = null;
    if (!this.data.isCompleted) {
      nextDueAt = this.data.hasDue
        ? combineDateTime(
            this.data.dueDate,
            this.data.dueTime,
            this.data.accountTimezone || undefined,
          )
        : null;
      payload.dueAt = nextDueAt;
    }

    const shouldSubscribe =
      this.data.notifyEnabled &&
      this.data.notifyAvailable &&
      Boolean(this.data.reminderTemplateId) &&
      Boolean(nextDueAt) &&
      !this.data.isCompleted;

    this.setData({ submitting: true });
    updateReminder(this.data.reminderId, payload)
      .then(async (response) => {
        this.setData({ submitting: false });
        if (!response.ok) {
          wx.showToast({
            title: formatApiErrorMessage(response.error, '保存失败'),
            icon: 'none',
          });
          return;
        }
        if (shouldSubscribe) {
          try {
            const { accepted } = await enableWechatNotifyForTarget({
              targetType: 'reminder',
              targetId: this.data.reminderId,
              templateId: this.data.reminderTemplateId,
            });
            wx.showToast({
              title: accepted ? '已保存并更新微信提醒' : '已保存，未重新授权微信提醒',
              icon: accepted ? 'success' : 'none',
            });
          } catch {
            wx.showToast({ title: '已保存，提醒授权同步失败', icon: 'none' });
          }
        } else {
          wx.showToast({ title: '已保存', icon: 'success' });
        }
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },
});

function formatContactLabel(contacts: ContactSummary[]): string {
  if (contacts.length === 0) {
    return '选择';
  }
  if (contacts.length === 1) {
    return contacts[0].displayName;
  }
  const names = contacts
    .slice(0, 2)
    .map((contact) => contact.displayName)
    .join('、');
  return `${names}等 ${contacts.length} 人`;
}

function markTagOptions(options: TagSummary[], selected: TagSummary[]): TagOption[] {
  const selectedIds = new Set(selected.map((tag) => tag.id));
  return options.map((tag) => ({ ...tag, selected: selectedIds.has(tag.id) }));
}

function mergeTagOptions(options: TagSummary[], selected: TagSummary[]): TagSummary[] {
  const optionIds = new Set(options.map((tag) => tag.id));
  return [...options, ...selected.filter((tag) => !optionIds.has(tag.id))];
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

function mergeSelectedTag(selected: TagSummary[], next: TagSummary): TagSummary[] {
  if (selected.some((tag) => tag.id === next.id)) {
    return selected;
  }
  return [...selected, next];
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

function titleTextareaHeight(title: string): number {
  const lines = Math.min(5, Math.max(2, Math.ceil(title.trim().length / 18)));
  return 32 + lines * 45;
}

function formatSourceLabel(source?: string, externalId?: string): string {
  if (!source || !externalId) {
    return '';
  }
  const sourceNames: Record<string, string> = {
    email: '邮件',
    wechat: '微信',
    wechat_message: '微信消息',
    work_order: '工单',
    ticket: '工单',
    tencent_doc: '腾讯文档',
    manual: '手动',
  };
  const name = sourceNames[source] || source;
  return `${name} · ${externalId}`;
}
