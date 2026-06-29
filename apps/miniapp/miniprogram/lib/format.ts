import { TODO_AVATAR_PALETTE, TODO_EVENT_ACCENT_PALETTE } from './design-tokens';

export function formatShortDate(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function zonedParts(instant: Date, timeZone: string): ZonedParts | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(instant);
    const pick = (type: string) => parts.find((p) => p.type === type)?.value;
    const year = Number(pick('year'));
    const month = Number(pick('month'));
    const day = Number(pick('day'));
    const hour = Number(pick('hour'));
    const minute = Number(pick('minute'));
    const normalizedHour = hour === 24 ? 0 : hour;
    if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
      return null;
    }
    return { year, month, day, hour: normalizedHour, minute };
  } catch {
    return null;
  }
}

/** Resolve account IANA timezone; falls back to device locale, then Shanghai. */
export function resolveAccountTimeZone(timeZone?: string): string {
  const explicit = (timeZone || '').trim();
  if (explicit) {
    return explicit;
  }
  try {
    const deviceTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (deviceTz && deviceTz.trim()) {
      return deviceTz.trim();
    }
  } catch {
    // ignore
  }
  return 'Asia/Shanghai';
}

function timeZoneOffsetMillis(utcMs: number, timeZone: string): number {
  const parts = zonedParts(new Date(utcMs), timeZone);
  if (!parts) {
    return 0;
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return asUtc - utcMs;
}

/** Wall clock in `timeZone` → UTC epoch ms (offset iteration; handles DST). */
function wallClockToUtcMillis(date: string, time: string, timeZone: string): number {
  const [y, m, d] = date.split('-').map((v) => parseInt(v, 10));
  const [hh, mm] = time.split(':').map((v) => parseInt(v, 10));
  let utc = Date.UTC(y, m - 1, d, hh, mm);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = timeZoneOffsetMillis(utc, timeZone);
    const next = Date.UTC(y, m - 1, d, hh, mm) - offset;
    if (next === utc) {
      return utc;
    }
    utc = next;
  }
  return utc;
}

export function combineDateTimeToMillis(date: string, time: string, timeZone?: string): number {
  return wallClockToUtcMillis(date, time, resolveAccountTimeZone(timeZone));
}

export function formatDateTime(iso: string | undefined, timeZone?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const tz = resolveAccountTimeZone(timeZone);
  const parts = zonedParts(date, tz);
  if (parts) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${parts.month}月${parts.day}日 ${pad(parts.hour)}:${pad(parts.minute)}`;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatClock(iso: string | undefined, timeZone?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const tz = resolveAccountTimeZone(timeZone);
  const parts = zonedParts(date, tz);
  if (parts) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(parts.hour)}:${pad(parts.minute)}`;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatTimeRange(startAt: string, endAt?: string, timeZone?: string): string {
  const start = formatDateTime(startAt, timeZone);
  if (!endAt) return start;
  const end = formatDateTime(endAt, timeZone);
  return `${start} - ${end.split(' ').pop()}`;
}

export function formatEventTimeRange(startAt: string, endAt?: string, timeZone?: string): string {
  const start = formatClock(startAt, timeZone);
  if (!start) return '';
  if (!endAt) return start;
  const end = formatClock(endAt, timeZone);
  return end ? `${start} – ${end}` : start;
}

export function combineDateTime(date: string, time: string, timeZone?: string): string {
  const ms = combineDateTimeToMillis(date, time, timeZone);
  return new Date(ms).toISOString();
}

export function splitIsoDateTime(
  iso: string | undefined,
  timeZone?: string,
): { date: string; time: string } {
  const tz = resolveAccountTimeZone(timeZone);
  if (!iso) {
    return {
      date: todayIsoDateInTimezone(tz),
      time: nowIsoTimeInTimezone(tz),
    };
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return {
      date: todayIsoDateInTimezone(tz),
      time: nowIsoTimeInTimezone(tz),
    };
  }
  const parts = zonedParts(parsed, tz);
  if (parts) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
      time: `${pad(parts.hour)}:${pad(parts.minute)}`,
    };
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

export interface WeekDayItem {
  iso: string;
  day: number;
  weekday: string;
  isToday: boolean;
  isSelected: boolean;
}

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map((part) => parseInt(part, 10));
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

/** Calendar date (YYYY-MM-DD) for an IANA timezone; falls back to device local. */
export function todayIsoDateInTimezone(timezone: string): string {
  const tz = (timezone || '').trim();
  if (!tz) {
    return todayIsoDate();
  }
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // invalid IANA id
  }
  return todayIsoDate();
}

export function formatIsoDateLabel(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatMonthYear(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function formatWeekdayLong(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return `星期${WEEKDAY_LABELS[date.getDay()]}`;
}

export function buildWeekStrip(isoDate: string, accountToday?: string): WeekDayItem[] {
  const anchor = parseIsoDate(isoDate);
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  const today = accountToday || todayIsoDate();
  const items: WeekDayItem[] = [];

  for (let index = 0; index < 7; index += 1) {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const iso = toIsoDate(current);
    items.push({
      iso,
      day: current.getDate(),
      weekday: WEEKDAY_LABELS[index],
      isToday: iso === today,
      isSelected: iso === isoDate,
    });
  }

  return items;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function isTodayIsoDate(isoDate: string, accountToday?: string): boolean {
  const today = accountToday || todayIsoDate();
  return isoDate === today;
}

export function isOverdueDueAt(dueAt: string | undefined, completed: boolean): boolean {
  if (!dueAt || completed) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  return due.getTime() < Date.now();
}

export function buildReminderSubline(input: {
  status: string;
  dueAt?: string;
  dueLabel: string;
  contactNames: string;
  isOverdue: boolean;
}): string {
  const completed = input.status === 'completed';
  const parts: string[] = [];

  if (input.status === 'in_progress') {
    parts.push('处理中');
  }

  if (!completed) {
    if (input.isOverdue) {
      parts.push('已逾期');
    } else if (!input.dueAt) {
      parts.push('无截止');
    }
  }

  if (input.dueLabel) {
    parts.push(completed ? `完成于 ${input.dueLabel}` : input.dueLabel);
  }

  if (input.contactNames) {
    parts.push(input.contactNames);
  }

  return parts.join(' · ');
}

export function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.slice(0, 1).toUpperCase();
}

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  }
  return TODO_AVATAR_PALETTE[Math.abs(hash) % TODO_AVATAR_PALETTE.length];
}

export const EVENT_ACCENT_COLORS = [...TODO_EVENT_ACCENT_PALETTE];

export function eventAccentColor(index: number): string {
  return TODO_EVENT_ACCENT_PALETTE[index % TODO_EVENT_ACCENT_PALETTE.length];
}

export function nowIsoTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function nowIsoTimeInTimezone(timeZone: string): string {
  const parts = zonedParts(new Date(), timeZone);
  if (!parts) return nowIsoTime();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** Live clock label in account timezone, e.g. `19:57`. */
export function formatNowClock(timeZone: string): string {
  return nowIsoTimeInTimezone(timeZone);
}
