const STATUS_LABELS: Record<string, string> = {
  pending: "待发送",
  sending: "发送中",
  sent: "已发送",
  failed: "发送失败",
  no_quota: "配额不足",
  skipped: "已跳过"
};

export function formatQuietHoursLabel(start: string, end: string): string {
  const quietStart = (start || "").trim();
  const quietEnd = (end || "").trim();
  if (!quietStart && !quietEnd) {
    return "未设置";
  }
  if (quietStart && quietEnd) {
    return `${quietStart} – ${quietEnd}`;
  }
  if (quietStart) {
    return `从 ${quietStart}`;
  }
  return `至 ${quietEnd}`;
}

export function formatNotificationStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function formatNotificationTargetType(targetType: string): string {
  if (targetType === "calendar_event") {
    return "日程";
  }
  if (targetType === "reminder") {
    return "提醒";
  }
  return targetType;
}

export function notificationStatusHint(item: {
  status: string;
  targetType: string;
}): string {
  if (item.status === "no_quota") {
    return "请重新编辑并授权微信提醒";
  }
  if (item.status === "failed") {
    return "稍后自动重试，或重新编辑并授权";
  }
  return "";
}
