"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_ACCENT_COLORS = void 0;
exports.formatDateTime = formatDateTime;
exports.formatClock = formatClock;
exports.formatTimeRange = formatTimeRange;
exports.formatEventTimeRange = formatEventTimeRange;
exports.combineDateTime = combineDateTime;
exports.todayIsoDate = todayIsoDate;
exports.formatIsoDateLabel = formatIsoDateLabel;
exports.formatMonthYear = formatMonthYear;
exports.formatWeekdayLong = formatWeekdayLong;
exports.buildWeekStrip = buildWeekStrip;
exports.shiftIsoDate = shiftIsoDate;
exports.isTodayIsoDate = isTodayIsoDate;
exports.isOverdueDueAt = isOverdueDueAt;
exports.buildReminderSubline = buildReminderSubline;
exports.getInitial = getInitial;
exports.avatarColor = avatarColor;
exports.eventAccentColor = eventAccentColor;
exports.nowIsoTime = nowIsoTime;
function formatDateTime(iso) {
    if (!iso)
        return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso;
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formatClock(iso) {
    if (!iso)
        return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function formatTimeRange(startAt, endAt) {
    const start = formatDateTime(startAt);
    if (!endAt)
        return start;
    const end = formatDateTime(endAt);
    return `${start} - ${end.split(" ").pop()}`;
}
function formatEventTimeRange(startAt, endAt) {
    const start = formatClock(startAt);
    if (!start)
        return "";
    if (!endAt)
        return start;
    const end = formatClock(endAt);
    return end ? `${start} – ${end}` : start;
}
function combineDateTime(date, time) {
    return `${date}T${time}:00+08:00`;
}
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];
function parseIsoDate(isoDate) {
    const [year, month, day] = isoDate.split("-").map((part) => parseInt(part, 10));
    return new Date(year, month - 1, day);
}
function toIsoDate(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function todayIsoDate() {
    return toIsoDate(new Date());
}
function formatIsoDateLabel(isoDate) {
    const date = parseIsoDate(isoDate);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
}
function formatMonthYear(isoDate) {
    const date = parseIsoDate(isoDate);
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}
function formatWeekdayLong(isoDate) {
    const date = parseIsoDate(isoDate);
    return `星期${WEEKDAY_LABELS[date.getDay()]}`;
}
function buildWeekStrip(isoDate) {
    const anchor = parseIsoDate(isoDate);
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - anchor.getDay());
    const today = todayIsoDate();
    const items = [];
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
function shiftIsoDate(isoDate, days) {
    const date = parseIsoDate(isoDate);
    date.setDate(date.getDate() + days);
    return toIsoDate(date);
}
function isTodayIsoDate(isoDate) {
    return isoDate === todayIsoDate();
}
function isOverdueDueAt(dueAt, completed) {
    if (!dueAt || completed)
        return false;
    const due = new Date(dueAt);
    if (Number.isNaN(due.getTime()))
        return false;
    return due.getTime() < Date.now();
}
function buildReminderSubline(input) {
    const completed = input.status === "completed";
    const parts = [];
    if (!completed) {
        if (input.isOverdue) {
            parts.push("已逾期");
        }
        else if (!input.dueAt) {
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
function getInitial(name) {
    const trimmed = name.trim();
    if (!trimmed)
        return "?";
    return trimmed.slice(0, 1).toUpperCase();
}
function avatarColor(seed) {
    const palette = ["#007AFF", "#5856D6", "#AF52DE", "#FF2D55", "#FF3B30", "#FF9500", "#34C759"];
    let hash = 0;
    for (let index = 0; index < seed.length; index += 1) {
        hash = seed.charCodeAt(index) + ((hash << 5) - hash);
    }
    return palette[Math.abs(hash) % palette.length];
}
exports.EVENT_ACCENT_COLORS = [
    "#FF3B30",
    "#FF9500",
    "#FFCC00",
    "#34C759",
    "#007AFF",
    "#5856D6",
    "#AF52DE"
];
function eventAccentColor(index) {
    return exports.EVENT_ACCENT_COLORS[index % exports.EVENT_ACCENT_COLORS.length];
}
function nowIsoTime() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
