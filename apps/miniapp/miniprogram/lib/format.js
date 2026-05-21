"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateTime = formatDateTime;
exports.formatTimeRange = formatTimeRange;
exports.combineDateTime = combineDateTime;
exports.todayIsoDate = todayIsoDate;
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
function formatTimeRange(startAt, endAt) {
    const start = formatDateTime(startAt);
    if (!endAt)
        return start;
    const end = formatDateTime(endAt);
    return `${start} - ${end.split(" ").pop()}`;
}
function combineDateTime(date, time) {
    return `${date}T${time}:00+08:00`;
}
function todayIsoDate() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
function nowIsoTime() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
