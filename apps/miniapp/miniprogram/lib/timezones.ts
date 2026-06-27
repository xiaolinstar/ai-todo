export interface TimezoneOption {
  id: string;
  label: string;
}

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { id: 'Asia/Shanghai', label: '中国（上海）' },
  { id: 'Asia/Hong_Kong', label: '中国香港' },
  { id: 'Asia/Taipei', label: '台北' },
  { id: 'Asia/Tokyo', label: '东京' },
  { id: 'Asia/Singapore', label: '新加坡' },
  { id: 'America/New_York', label: '美国（纽约）' },
  { id: 'America/Los_Angeles', label: '美国（洛杉矶）' },
  { id: 'America/Chicago', label: '美国（芝加哥）' },
  { id: 'Europe/London', label: '英国（伦敦）' },
  { id: 'Europe/Berlin', label: '中欧（柏林）' },
  { id: 'UTC', label: 'UTC' },
];

export function timezoneLabel(id: string): string {
  const match = TIMEZONE_OPTIONS.find((item) => item.id === id);
  return match ? match.label : id;
}

export function timezoneIndex(id: string): number {
  const index = TIMEZONE_OPTIONS.findIndex((item) => item.id === id);
  return index >= 0 ? index : 0;
}
