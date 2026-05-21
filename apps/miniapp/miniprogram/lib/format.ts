export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatClock(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatTimeRange(startAt: string, endAt?: string): string {
  const start = formatDateTime(startAt);
  if (!endAt) return start;
  const end = formatDateTime(endAt);
  return `${start} - ${end.split(" ").pop()}`;
}

export function formatEventTimeRange(startAt: string, endAt?: string): string {
  const start = formatClock(startAt);
  if (!start) return "";
  if (!endAt) return start;
  const end = formatClock(endAt);
  return end ? `${start} – ${end}` : start;
}

export function combineDateTime(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export interface WeekDayItem {
  iso: string;
  day: number;
  weekday: string;
  isToday: boolean;
  isSelected: boolean;
}

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map((part) => parseInt(part, 10));
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIsoDate(): string {
  return toIsoDate(new Date());
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

export function buildWeekStrip(isoDate: string): WeekDayItem[] {
  const anchor = parseIsoDate(isoDate);
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());
  const today = todayIsoDate();
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
      isSelected: iso === isoDate
    });
  }

  return items;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function isTodayIsoDate(isoDate: string): boolean {
  return isoDate === todayIsoDate();
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
  const completed = input.status === "completed";
  const parts: string[] = [];

  if (!completed) {
    if (input.isOverdue) {
      parts.push("已逾期");
    } else if (!input.dueAt) {
      parts.push("无截止");
    }
  }

  if (input.dueLabel) {
    parts.push(completed ? `完成于 ${input.dueLabel}` : input.dueLabel);
  }

  if (input.contactNames) {
    parts.push(input.contactNames);
  }

  return parts.join(" · ");
}

export function getInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 1).toUpperCase();
}

export function avatarColor(seed: string): string {
  const palette = ["#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#FF3B30", "#FF9500", "#34C759"];
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export const EVENT_ACCENT_COLORS = [
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#007AFF",
  "#5856D6",
  "#AF52DE"
];

export function eventAccentColor(index: number): string {
  return EVENT_ACCENT_COLORS[index % EVENT_ACCENT_COLORS.length];
}

export function nowIsoTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
