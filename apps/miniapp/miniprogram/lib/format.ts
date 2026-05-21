export function formatDateTime(iso: string | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatTimeRange(startAt: string, endAt?: string): string {
  const start = formatDateTime(startAt);
  if (!endAt) return start;
  const end = formatDateTime(endAt);
  return `${start} - ${end.split(" ").pop()}`;
}

export function combineDateTime(date: string, time: string): string {
  return `${date}T${time}:00+08:00`;
}

export function todayIsoDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function nowIsoTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
