import { handleApiError } from '../../lib/error-handler';
import { completeReminder, deleteReminder, fetchReminders, fetchTags } from '../../lib/api';
import { loadAccountDay } from '../../lib/account-day';
import { TODO_MODAL_CONFIRM_DANGER } from '../../lib/design-tokens';
import type { ReminderSummary, TagSummary } from '../../lib/api';
import {
  buildReminderSubline,
  formatDateTime,
  formatIsoDateLabel,
  formatWeekdayLong,
  isOverdueDueAt,
  splitIsoDateTime,
} from '../../lib/format';
import { updateTabBarSelected } from '../../lib/tab-bar';
import { getWindowWidthPx } from '../../lib/window-metrics';
import { buildAppShareOptions, buildAppShareTimelineOptions } from '../../lib/share';
import { loadContentPrefs } from '../../lib/content-prefs';
import { withTagStyle, type TagStyleFields } from '../../lib/tag-style';
import {
  deriveNotifyUi,
  enableWechatNotifyForTarget,
  loadWechatNotificationPrefs,
} from '../../lib/wechat-notify';

type TagView = TagSummary & TagStyleFields;

interface ReminderView extends ReminderSummary {
  dueLabel: string;
  contactNames: string;
  sourceLabel: string;
  subline: string;
  isOverdue: boolean;
  completing: boolean;
  exiting: boolean;
  deleting: boolean;
  swipeX: number;
  swiping: boolean;
  pressing: boolean;
  deleteVisible: boolean;
  showEnableButton: boolean;
  showEnabledLabel: boolean;
  showAwaitingBadge: boolean;
  visibleTags: TagView[];
  hiddenTagCount: number;
}

interface ReminderGroup {
  key: 'overdue' | 'today' | 'future';
  title: string;
  items: ReminderView[];
}

const COMPLETE_HOLD_MS = 1200;
const EXIT_ANIM_MS = 340;
const SWIPE_OPEN_THRESHOLD_RATIO = 0.42;
const SWIPE_TRIGGER_PX = 28;
const TAP_SLOP_PX = 12;

type TabKey = 'pending' | 'in_progress' | 'completed';

function sourceLabel(source?: string): string {
  if (!source) return '';
  const labels: Record<string, string> = {
    email: '邮件',
    jira: '工单',
    agent: 'Agent',
    cli: 'CLI',
  };
  return labels[source] || source;
}

function enrichReminder(
  item: ReminderSummary,
  timeZone: string,
  notifyAvailable: boolean,
): ReminderView {
  const completed = item.status === 'completed';
  const dueLabel = formatDateTime(item.dueAt, timeZone);
  const contactNames = (item.contacts || [])
    .map((c) => (c.handle ? c.handle : c.displayName))
    .join('、');
  const isOverdue = isOverdueDueAt(item.dueAt, completed);
  const tags = item.tags || [];

  const base: ReminderView = {
    ...item,
    dueLabel,
    contactNames,
    sourceLabel: sourceLabel(item.source),
    isOverdue,
    subline: buildReminderSubline({
      status: item.status,
      dueAt: item.dueAt,
      dueLabel: completed ? dueLabel : '',
      contactNames,
      isOverdue: completed ? false : isOverdue,
    }),
    completing: false,
    exiting: false,
    deleting: false,
    swipeX: 0,
    swiping: false,
    pressing: false,
    deleteVisible: false,
    showEnableButton: false,
    showEnabledLabel: false,
    showAwaitingBadge: false,
    visibleTags: tags.slice(0, 2).map(withTagStyle),
    hiddenTagCount: Math.max(0, tags.length - 2),
  };

  const notifyUi = deriveNotifyUi({
    notifyAvailable,
    wechatNotifyRequested: item.wechatNotifyRequested,
    wechatNotifyStatus: item.wechatNotifyStatus,
    scheduleAt: item.remindAt || item.dueAt,
  });
  return { ...base, ...notifyUi };
}

function groupPendingReminders(
  items: ReminderView[],
  today: string,
  timeZone: string,
): ReminderGroup[] {
  const groups: ReminderGroup[] = [
    { key: 'overdue', title: '逾期', items: [] },
    { key: 'today', title: '今天', items: [] },
    { key: 'future', title: '未来', items: [] },
  ];

  items.forEach((item) => {
    if (item.isOverdue && !item.completing) {
      groups[0].items.push(item);
      return;
    }
    const dueDate = item.dueAt ? splitIsoDateTime(item.dueAt, timeZone).date : '';
    if (dueDate === today) {
      groups[1].items.push(item);
      return;
    }
    groups[2].items.push(item);
  });

  return groups.filter((group) => group.items.length > 0);
}

function isDeleteRevealed(swipeX: number): boolean {
  return Math.abs(swipeX) >= SWIPE_TRIGGER_PX;
}

function touchPoint(e: { touches?: Array<{ clientX: number; clientY: number }> }): {
  x: number;
  y: number;
} | null {
  const touch = e.touches?.[0];
  if (!touch) return null;
  return { x: touch.clientX, y: touch.clientY };
}

function changedTouchPoint(e: {
  changedTouches?: Array<{ clientX: number; clientY: number }>;
}): { x: number; y: number } | null {
  const touch = e.changedTouches?.[0];
  if (!touch) return null;
  return { x: touch.clientX, y: touch.clientY };
}

Page({
  data: {
    loading: false,
    loaded: false,
    error: '',
    dateLabel: '',
    weekdayLabel: '',
    timezone: '',
    accountToday: '',
    activeTab: 'pending' as TabKey,
    pendingCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    overdueCount: 0,
    pendingGroups: [] as ReminderGroup[],
    inProgressGroups: [] as ReminderGroup[],
    pending: [] as ReminderView[],
    inProgress: [] as ReminderView[],
    completed: [] as ReminderView[],
    searchQuery: '',
    searchTag: '',
    searchMode: false,
    searchResults: [] as ReminderView[],
    tagOptions: [] as { id: string; name: string; color: string }[],
    showTagsInList: true,
    notifyAvailable: false,
    reminderTemplateId: '',
  },

  _completeTimers: {} as Record<string, ReturnType<typeof setTimeout>>,
  _touchStartX: 0,
  _touchStartY: 0,
  _startSwipeX: 0,
  _activeRowId: '',
  _gestureSwipeActive: false,
  _deleteActionWidthPx: 86,
  _pendingReminderId: '',
  _searchTimer: null as ReturnType<typeof setTimeout> | null,

  onLoad(options: { reminderId?: string }) {
    const reminderId = (options?.reminderId || '').trim();
    if (reminderId) {
      this._pendingReminderId = reminderId;
    }
  },

  onShareAppMessage() {
    return buildAppShareOptions();
  },

  onShareTimeline() {
    return buildAppShareTimelineOptions();
  },

  onShow() {
    updateTabBarSelected(0);
    this.updateDeleteActionWidth();
    this.loadReminders().then(() => this.openPendingReminderIfNeeded());
  },

  openPendingReminderIfNeeded() {
    const reminderId = this._pendingReminderId;
    if (!reminderId) {
      return;
    }
    this._pendingReminderId = '';
    wx.navigateTo({
      url: `/pages/reminder-edit/reminder-edit?id=${encodeURIComponent(reminderId)}`,
    });
  },

  onUnload() {
    Object.keys(this._completeTimers).forEach((id) => {
      this.clearCompleteTimer(id);
    });
  },

  onPullDownRefresh() {
    this.loadReminders().finally(() => wx.stopPullDownRefresh());
  },

  onSearchInput(e: { detail: { value: string } }) {
    const searchQuery = e.detail.value;
    this.setData({ searchQuery });
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
    }
    this._searchTimer = setTimeout(() => {
      this.loadReminders();
    }, 300);
  },

  onClearSearch() {
    if (this._searchTimer) {
      clearTimeout(this._searchTimer);
      this._searchTimer = null;
    }
    this.setData({ searchQuery: '', searchTag: '', searchMode: false, searchResults: [] });
    this.loadReminders();
  },

  onTagChipTap(e: { currentTarget: { dataset: { name?: string } } }) {
    const name = (e.currentTarget.dataset.name || '').trim();
    const nextTag = this.data.searchTag === name ? '' : name;
    this.setData({ searchTag: nextTag });
    this.loadReminders();
  },

  loadReminders() {
    const searchQuery = this.data.searchQuery.trim();
    const searchTag = this.data.searchTag.trim();
    const searchMode = Boolean(searchQuery || searchTag);
    this.setData({ loading: true, error: '', searchMode });

    if (searchMode) {
      return Promise.all([
        loadAccountDay(),
        loadContentPrefs(),
        loadWechatNotificationPrefs(),
        fetchTags({ limit: 50 }),
      ])
        .then(([account, contentPrefs, notifyPrefs, tagsRes]) => {
          const showTagsInList = contentPrefs.reminders.showTagsInList;
          const tagOptions =
            showTagsInList && tagsRes.ok && tagsRes.data
              ? tagsRes.data.items.map(withTagStyle)
              : [];
          return fetchReminders({
            q: searchQuery || undefined,
            tags: searchTag ? [searchTag] : undefined,
            sort: 'updated_at',
            limit: 100,
          }).then((searchRes) => ({ account, notifyPrefs, showTagsInList, tagOptions, searchRes }));
        })
        .then(({ account, notifyPrefs, showTagsInList, tagOptions, searchRes }) => {
          if (!searchRes.ok || !searchRes.data) {
            this.setData({
              loading: false,
              loaded: true,
              error: searchRes.error?.message || '搜索失败',
            });
            return;
          }
          const tz = account.timezone;
          const searchResults = searchRes.data.items.map((item) =>
            enrichReminder(item, tz, notifyPrefs.notifyAvailable),
          );
          this.setData({
            loading: false,
            loaded: true,
            timezone: tz,
            accountToday: account.today,
            dateLabel: formatIsoDateLabel(account.today),
            weekdayLabel: formatWeekdayLong(account.today),
            tagOptions,
            showTagsInList,
            searchResults,
            notifyAvailable: notifyPrefs.notifyAvailable,
            reminderTemplateId: notifyPrefs.reminderTemplateId,
          });
        })
        .catch(() => {
          this.setData({ loading: false, loaded: true, error: '网络错误' });
        });
    }

    return Promise.all([
      loadAccountDay(),
      loadContentPrefs(),
      loadWechatNotificationPrefs(),
      fetchTags({ limit: 50 }),
      fetchReminders({ status: 'pending', sort: 'due_at' }),
      fetchReminders({ status: 'in_progress', sort: 'due_at' }),
      fetchReminders({ status: 'completed', sort: 'completed_at' }),
    ])
      .then(
        ([
          account,
          contentPrefs,
          notifyPrefs,
          tagsRes,
          pendingRes,
          inProgressRes,
          completedRes,
        ]) => {
          if (
            !pendingRes.ok ||
            !pendingRes.data ||
            !inProgressRes.ok ||
            !inProgressRes.data ||
            !completedRes.ok ||
            !completedRes.data
          ) {
            this.setData({
              loading: false,
              loaded: true,
              error:
                pendingRes.error?.message ||
                inProgressRes.error?.message ||
                completedRes.error?.message ||
                '加载失败，请在「我的」页检查 API 地址',
            });
            return;
          }

          const { timezone, today } = account;
          const notifyAvailable = notifyPrefs.notifyAvailable;
          const showTagsInList = contentPrefs.reminders.showTagsInList;
          const tagOptions =
            showTagsInList && tagsRes.ok && tagsRes.data
              ? tagsRes.data.items.map(withTagStyle)
              : [];
          const pendingItems = pendingRes.data.items.map((item) =>
            enrichReminder(item, timezone, notifyAvailable),
          );
          const inProgressItems = inProgressRes.data.items.map((item) =>
            enrichReminder(item, timezone, notifyAvailable),
          );
          const completedItems = completedRes.data.items.map((item) =>
            enrichReminder(item, timezone, false),
          );
          const animating = this.data.pending.filter(
            (item: ReminderView) => item.completing || item.exiting,
          );
          const animatingIds = new Set(animating.map((item: ReminderView) => item.id));
          const pending = [
            ...animating,
            ...pendingItems.filter((item) => !animatingIds.has(item.id)),
          ];
          const inProgress = inProgressItems;
          const completed = completedItems;
          const openItems = [...pending, ...inProgress];

          this.setData({
            loading: false,
            loaded: true,
            dateLabel: formatIsoDateLabel(today),
            weekdayLabel: formatWeekdayLong(today),
            timezone,
            accountToday: today,
            pendingCount: pending.length,
            inProgressCount: inProgress.length,
            completedCount: completed.length,
            overdueCount: openItems.filter((item) => item.isOverdue).length,
            pendingGroups: groupPendingReminders(pending, today, timezone),
            inProgressGroups: groupPendingReminders(inProgress, today, timezone),
            pending,
            inProgress,
            completed,
            tagOptions,
            showTagsInList,
            searchMode: false,
            searchResults: [],
            notifyAvailable,
            reminderTemplateId: notifyPrefs.reminderTemplateId,
          });
        },
      )
      .catch(() => {
        this.setData({
          loading: false,
          loaded: true,
          error: '无法连接 API，请在「我的」页配置地址并开启「不校验合法域名」',
        });
      });
  },

  onTabChange(e: { currentTarget: { dataset: { tab: TabKey } } }) {
    const tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
  },

  onOverdueHintTap() {
    if (this.data.activeTab === 'pending') return;
    this.setData({ activeTab: 'pending' });
  },

  goMine() {
    wx.switchTab({ url: '/pages/mine/mine' });
  },

  findReminderItem(id: string): ReminderView | undefined {
    return (
      this.data.pending.find((entry: ReminderView) => entry.id === id) ||
      this.data.inProgress.find((entry: ReminderView) => entry.id === id) ||
      this.data.completed.find((entry: ReminderView) => entry.id === id)
    );
  },

  updateDeleteActionWidth() {
    try {
      this._deleteActionWidthPx = Math.round((getWindowWidthPx() * 160) / 750);
    } catch {
      this._deleteActionWidthPx = 86;
    }
  },

  updateCounts(pending: ReminderView[], inProgress: ReminderView[], completed: ReminderView[]) {
    const openItems = [...pending, ...inProgress];
    this.setData({
      pendingCount: pending.length,
      inProgressCount: inProgress.length,
      completedCount: completed.length,
      overdueCount: openItems.filter((item) => item.isOverdue && !item.completing).length,
      pendingGroups: groupPendingReminders(pending, this.data.accountToday, this.data.timezone),
      inProgressGroups: groupPendingReminders(
        inProgress,
        this.data.accountToday,
        this.data.timezone,
      ),
    });
  },

  patchPendingItem(id: string, patch: Partial<ReminderView>) {
    const pending = this.data.pending.map((item: ReminderView) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    this.setData({
      pending,
      pendingGroups: groupPendingReminders(pending, this.data.accountToday, this.data.timezone),
    });
    return pending;
  },

  patchReminderItem(id: string, patch: Partial<ReminderView>) {
    const pending = this.data.pending.map((item: ReminderView) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    const inProgress = this.data.inProgress.map((item: ReminderView) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    const completed = this.data.completed.map((item: ReminderView) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    this.setData({
      pending,
      inProgress,
      pendingGroups: groupPendingReminders(pending, this.data.accountToday, this.data.timezone),
      inProgressGroups: groupPendingReminders(
        inProgress,
        this.data.accountToday,
        this.data.timezone,
      ),
      completed,
    });
    return { pending, inProgress, completed };
  },

  resetRowGesture() {
    this._activeRowId = '';
    this._gestureSwipeActive = false;
    this._startSwipeX = 0;
  },

  closeOpenSwipes(exceptId = '') {
    const closeItem = (item: ReminderView) =>
      item.id === exceptId || item.swipeX === 0
        ? item
        : { ...item, swipeX: 0, swiping: false, pressing: false, deleteVisible: false };
    const pending = this.data.pending.map(closeItem);
    const inProgress = this.data.inProgress.map(closeItem);
    this.setData({
      pending,
      inProgress,
      pendingGroups: groupPendingReminders(pending, this.data.accountToday, this.data.timezone),
      inProgressGroups: groupPendingReminders(
        inProgress,
        this.data.accountToday,
        this.data.timezone,
      ),
      completed: this.data.completed.map(closeItem),
    });
  },

  clearCompleteTimer(id: string) {
    const timer = this._completeTimers[id];
    if (timer) {
      clearTimeout(timer);
      delete this._completeTimers[id];
    }
  },

  scheduleCompleteTimer(id: string, delay: number, callback: () => void) {
    this.clearCompleteTimer(id);
    this._completeTimers[id] = setTimeout(callback, delay);
  },

  finalizeCompletedItem(id: string) {
    const item = this.findReminderItem(id);
    if (!item) return;

    const completedItem: ReminderView = enrichReminder(
      {
        ...item,
        status: 'completed',
      },
      this.data.timezone,
      false,
    );

    const pending = this.data.pending.filter((entry: ReminderView) => entry.id !== id);
    const inProgress = this.data.inProgress.filter((entry: ReminderView) => entry.id !== id);
    const completed = [
      completedItem,
      ...this.data.completed.filter((entry: ReminderView) => entry.id !== id),
    ];

    this.setData({
      pending,
      inProgress,
      pendingGroups: groupPendingReminders(pending, this.data.accountToday, this.data.timezone),
      inProgressGroups: groupPendingReminders(
        inProgress,
        this.data.accountToday,
        this.data.timezone,
      ),
      completed,
    });
    this.updateCounts(pending, inProgress, completed);
    this.clearCompleteTimer(id);
  },

  revertCompletingItem(id: string) {
    this.clearCompleteTimer(id);
    this.patchOpenItem(id, { completing: false, exiting: false });
  },

  patchOpenItem(id: string, patch: Partial<ReminderView>) {
    if (this.data.pending.some((entry: ReminderView) => entry.id === id)) {
      return this.patchPendingItem(id, patch);
    }
    const inProgress = this.data.inProgress.map((item: ReminderView) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    this.setData({
      inProgress,
      inProgressGroups: groupPendingReminders(
        inProgress,
        this.data.accountToday,
        this.data.timezone,
      ),
    });
    return inProgress;
  },

  onComplete(e: { currentTarget: { dataset: { id: string } } }) {
    const id = e.currentTarget.dataset.id;
    const item = this.findReminderItem(id);
    if (!item || item.completing || item.exiting || item.deleting || item.status === 'completed') {
      return;
    }

    this.patchOpenItem(id, { completing: true, pressing: false });

    completeReminder(id)
      .then((response) => {
        if (!response.ok) {
          this.revertCompletingItem(id);
          handleApiError(response.error, '操作失败');
          return;
        }

        this.scheduleCompleteTimer(id, COMPLETE_HOLD_MS, () => {
          this.patchPendingItem(id, { exiting: true });

          this.scheduleCompleteTimer(id, EXIT_ANIM_MS, () => {
            this.finalizeCompletedItem(id);
          });
        });
      })
      .catch(() => {
        this.revertCompletingItem(id);
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  onRowTouchStart(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }) {
    const point = touchPoint(e);
    if (!point) return;
    const id = e.currentTarget.dataset.id;

    const item = this.findReminderItem(id);
    if (!item || item.completing || item.exiting || item.deleting) return;

    this._activeRowId = id;
    this._gestureSwipeActive = false;
    this._touchStartX = point.x;
    this._touchStartY = point.y;
    this._startSwipeX = item.swipeX;
    this.closeOpenSwipes(id);
    this.patchReminderItem(id, {
      pressing: true,
      swiping: false,
      deleteVisible: isDeleteRevealed(item.swipeX),
    });
  },

  onSwipeMove(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }) {
    const point = touchPoint(e);
    const id = e.currentTarget.dataset.id;
    if (!point || id !== this._activeRowId) return;

    const deltaX = point.x - this._touchStartX;
    const deltaY = point.y - this._touchStartY;
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) return;

    const canSwipe =
      this._gestureSwipeActive || this._startSwipeX !== 0 || Math.abs(deltaX) >= SWIPE_TRIGGER_PX;
    if (!canSwipe) return;

    this._gestureSwipeActive = true;
    const swipeX = Math.max(-this._deleteActionWidthPx, Math.min(0, this._startSwipeX + deltaX));
    this.patchReminderItem(id, {
      swipeX,
      swiping: true,
      pressing: false,
      deleteVisible: isDeleteRevealed(swipeX),
    });
  },

  onRowTouchEnd(e: {
    currentTarget: { dataset: { id: string } };
    changedTouches?: Array<{ clientX: number; clientY: number }>;
  }) {
    const id = e.currentTarget.dataset.id;
    if (id !== this._activeRowId) {
      this.resetRowGesture();
      return;
    }

    const item = this.findReminderItem(id);
    if (!item) {
      this.resetRowGesture();
      return;
    }

    const point = changedTouchPoint(e);
    const moved = point ? Math.hypot(point.x - this._touchStartX, point.y - this._touchStartY) : 0;

    let swipeX = item.swipeX;
    if (this._gestureSwipeActive) {
      const shouldOpen = Math.abs(swipeX) >= this._deleteActionWidthPx * SWIPE_OPEN_THRESHOLD_RATIO;
      swipeX = shouldOpen ? -this._deleteActionWidthPx : 0;
    } else if (moved < TAP_SLOP_PX) {
      swipeX = 0;
      if (!isDeleteRevealed(this._startSwipeX) && !item.completing && !item.deleting) {
        this.openReminderEdit(id);
      }
    } else {
      swipeX = this._startSwipeX;
    }

    this.patchReminderItem(id, {
      swipeX,
      swiping: false,
      pressing: false,
      deleteVisible: isDeleteRevealed(swipeX),
    });
    this.resetRowGesture();
  },

  openReminderEdit(id: string) {
    const item = this.findReminderItem(id);
    if (!item || item.completing || item.exiting || item.deleting) return;
    wx.navigateTo({ url: `/pages/reminder-edit/reminder-edit?id=${encodeURIComponent(id)}` });
  },

  onSearchResultTap(e: { currentTarget: { dataset: { id: string } } }) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/reminder-edit/reminder-edit?id=${encodeURIComponent(id)}` });
  },

  onDeleteTap(e: { currentTarget: { dataset: { id: string } } }) {
    const id = e.currentTarget.dataset.id;
    const item = this.findReminderItem(id);
    if (!item || item.deleting || item.completing || item.exiting) return;

    wx.showModal({
      title: '删除提醒',
      content: `确定删除“${item.title}”？`,
      confirmText: '删除',
      confirmColor: TODO_MODAL_CONFIRM_DANGER,
      success: (res) => {
        if (!res.confirm) {
          this.patchReminderItem(id, { swipeX: 0, swiping: false, deleteVisible: false });
          return;
        }
        this.deleteItem(id);
      },
    });
  },

  deleteItem(id: string) {
    this.patchReminderItem(id, {
      deleting: true,
      exiting: true,
      swiping: false,
      deleteVisible: false,
    });
    deleteReminder(id)
      .then((response) => {
        if (!response.ok) {
          this.patchReminderItem(id, { deleting: false, exiting: false, swipeX: 0 });
          handleApiError(response.error, '删除失败');
          return;
        }

        setTimeout(() => {
          const pending = this.data.pending.filter((entry: ReminderView) => entry.id !== id);
          const inProgress = this.data.inProgress.filter((entry: ReminderView) => entry.id !== id);
          const completed = this.data.completed.filter((entry: ReminderView) => entry.id !== id);
          this.setData({
            pending,
            inProgress,
            pendingGroups: groupPendingReminders(
              pending,
              this.data.accountToday,
              this.data.timezone,
            ),
            inProgressGroups: groupPendingReminders(
              inProgress,
              this.data.accountToday,
              this.data.timezone,
            ),
            completed,
          });
          this.updateCounts(pending, inProgress, completed);
          this.clearCompleteTimer(id);
          wx.showToast({ title: '已删除', icon: 'success' });
        }, EXIT_ANIM_MS);
      })
      .catch(() => {
        this.patchReminderItem(id, { deleting: false, exiting: false, swipeX: 0 });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  onEnableNotify(e: { currentTarget: { dataset: { id: string } } }) {
    const reminderId = e.currentTarget.dataset.id;
    const templateId = this.data.reminderTemplateId;
    if (!reminderId || !templateId) {
      return;
    }
    enableWechatNotifyForTarget({
      targetType: 'reminder',
      targetId: reminderId,
      templateId,
    })
      .then(({ accepted }) => {
        wx.showToast({
          title: accepted ? '已开启微信提醒' : '未授权微信提醒',
          icon: accepted ? 'success' : 'none',
        });
        if (accepted) {
          this.loadReminders();
        }
      })
      .catch(() => {
        wx.showToast({ title: '提醒授权失败', icon: 'none' });
      });
  },
});
