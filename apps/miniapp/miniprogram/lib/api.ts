import { getConfig } from "./config";

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}

export interface UserSummary {
  id: string;
  username?: string;
  displayName: string;
  timezone: string;
}

export interface ContactSummary {
  id: string;
  handle: string;
  displayName: string;
  nickname?: string;
  company?: string;
  primaryEmail?: string;
  primaryPhone?: string;
}

export interface ReminderSummary {
  id: string;
  title: string;
  status: string;
  dueAt?: string;
  contacts?: ContactSummary[];
}

export interface CalendarEventSummary {
  id: string;
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  contacts?: ContactSummary[];
}

export interface TodayResult {
  date: string;
  timezone: string;
  reminders: ReminderSummary[];
  calendarEvents: CalendarEventSummary[];
}

export interface MeResult {
  user: UserSummary;
}

export interface ContactListResult {
  items: ContactSummary[];
}

function buildUrl(path: string): string {
  const { apiUrl } = getConfig();
  return `${apiUrl.replace(/\/$/, "")}${path}`;
}

function buildHeaders(): Record<string, string> {
  const { token } = getConfig();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-client-source": "miniapp"
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

export function request<T>(
  path: string,
  options: { method?: string; data?: object } = {}
): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(path),
      method: options.method || "GET",
      data: options.data,
      header: buildHeaders(),
      success(res) {
        if (res.statusCode >= 400) {
          const body = res.data as ApiResponse<T> | undefined;
          if (body && typeof body === "object" && body.ok === false && body.error) {
            resolve(body);
            return;
          }
          resolve({
            ok: false,
            error: { code: "HTTP_ERROR", message: `HTTP ${res.statusCode}` }
          });
          return;
        }
        resolve(res.data as ApiResponse<T>);
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

export function fetchToday() {
  return request<TodayResult>("/v1/today");
}

export function fetchRemindersToday() {
  return request<{ items: ReminderSummary[] }>("/v1/reminders/today");
}

export function fetchCalendarToday() {
  return request<{ items: CalendarEventSummary[] }>("/v1/calendar/today");
}

export function fetchCalendarByDate(date: string) {
  return request<{ items: CalendarEventSummary[] }>(
    `/v1/calendar/events?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`
  );
}

export function fetchMe() {
  return request<MeResult>("/v1/me");
}

export function completeReminder(reminderId: string) {
  return request<{ reminder: ReminderSummary }>(`/v1/reminders/${reminderId}/complete`, {
    method: "POST",
    data: {}
  });
}

export function createReminder(input: {
  title: string;
  dueAt?: string;
  contactIds?: string[];
}) {
  return request<{ reminder: ReminderSummary }>("/v1/reminders", {
    method: "POST",
    data: input
  });
}

export function createCalendarEvent(input: {
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  contactIds?: string[];
}) {
  return request<{ calendarEvent: CalendarEventSummary }>("/v1/calendar/events", {
    method: "POST",
    data: input
  });
}

export function searchContacts(query?: string) {
  const q = query ? `?q=${encodeURIComponent(query)}` : "";
  return request<ContactListResult>(`/v1/contacts${q}`);
}

export function createContact(input: {
  displayName: string;
  methods?: Array<{ type: string; value: string; isPrimary?: boolean }>;
}) {
  return request<{ contact: ContactSummary }>("/v1/contacts", {
    method: "POST",
    data: input
  });
}

export function issuePat(name: string) {
  return request<{ id: string; token: string; name: string; scopes: string[] }>(
    "/v1/api-tokens",
    {
      method: "POST",
      data: { name, scopes: ["read", "write"] }
    }
  );
}
