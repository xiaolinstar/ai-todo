import { fetchMe } from './api';
import { combineDateTimeToMillis, splitIsoDateTime } from './format';

const STORAGE_PREFIX = 'contentPrefs:v1:';

export type ContactSortMode = 'name' | 'updated';

export interface CalendarContentPrefs {
  defaultHasEnd: boolean;
  defaultDurationMinutes: 30 | 60 | 90;
  selectTodayOnOpen: boolean;
}

export interface ContactsContentPrefs {
  sortMode: ContactSortMode;
  showHandleInList: boolean;
}

export interface ContentPrefs {
  calendar: CalendarContentPrefs;
  contacts: ContactsContentPrefs;
}

const DEFAULT_PREFS: ContentPrefs = {
  calendar: {
    defaultHasEnd: true,
    defaultDurationMinutes: 60,
    selectTodayOnOpen: true,
  },
  contacts: {
    sortMode: 'name',
    showHandleInList: true,
  },
};

let cachedUserId = '';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId || 'guest'}`;
}

function normalizePrefs(raw: Partial<ContentPrefs> | null): ContentPrefs {
  const calendar = { ...DEFAULT_PREFS.calendar, ...raw?.calendar };
  const duration = calendar.defaultDurationMinutes;
  if (duration !== 30 && duration !== 60 && duration !== 90) {
    calendar.defaultDurationMinutes = 60;
  }
  const contacts = { ...DEFAULT_PREFS.contacts, ...raw?.contacts };
  if (contacts.sortMode !== 'name' && contacts.sortMode !== 'updated') {
    contacts.sortMode = 'name';
  }
  return { calendar, contacts };
}

export function readContentPrefsSync(userId?: string): ContentPrefs {
  const id = userId || cachedUserId || 'guest';
  try {
    const stored = wx.getStorageSync(storageKey(id));
    if (stored && typeof stored === 'object') {
      return normalizePrefs(stored as Partial<ContentPrefs>);
    }
  } catch {
    // ignore
  }
  return normalizePrefs(null);
}

export function writeContentPrefs(prefs: ContentPrefs, userId?: string): void {
  const id = userId || cachedUserId || 'guest';
  wx.setStorageSync(storageKey(id), prefs);
}

export function loadContentPrefs(): Promise<ContentPrefs> {
  return fetchMe()
    .then((response) => {
      if (response.ok && response.data?.user.id) {
        cachedUserId = response.data.user.id;
      }
      return readContentPrefsSync(cachedUserId);
    })
    .catch(() => readContentPrefsSync(cachedUserId));
}

export function saveContentPrefs(patch: {
  calendar?: Partial<CalendarContentPrefs>;
  contacts?: Partial<ContactsContentPrefs>;
}): Promise<ContentPrefs> {
  return loadContentPrefs().then((current) => {
    const next = normalizePrefs({
      calendar: { ...current.calendar, ...patch.calendar },
      contacts: { ...current.contacts, ...patch.contacts },
    });
    writeContentPrefs(next, cachedUserId);
    return next;
  });
}

export function sortContacts<T extends { displayName: string; handle: string }>(
  items: T[],
  mode: ContactSortMode,
): T[] {
  const copy = [...items];
  if (mode === 'name') {
    copy.sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN'));
    return copy;
  }
  return copy;
}

export function buildContactSubtitle(
  item: {
    handle: string;
    primaryEmail?: string;
    primaryPhone?: string;
    company?: string;
  },
  prefs: ContactsContentPrefs,
): string {
  const parts: string[] = [];
  if (prefs.showHandleInList && item.handle) {
    parts.push(item.handle);
  }
  if (item.primaryEmail) parts.push(item.primaryEmail);
  if (item.primaryPhone) parts.push(item.primaryPhone);
  if (item.company) parts.push(item.company);
  return parts.join(' · ');
}

export function applyDefaultEventEnd(
  startDate: string,
  startTime: string,
  prefs: CalendarContentPrefs,
  timeZone?: string,
): { hasEnd: boolean; endDate: string; endTime: string } {
  if (!prefs.defaultHasEnd) {
    return { hasEnd: false, endDate: startDate, endTime: startTime };
  }
  const startMs = combineDateTimeToMillis(startDate, startTime, timeZone);
  const endMs = startMs + prefs.defaultDurationMinutes * 60 * 1000;
  const end = splitIsoDateTime(new Date(endMs).toISOString(), timeZone);
  return {
    hasEnd: true,
    endDate: end.date,
    endTime: end.time,
  };
}
