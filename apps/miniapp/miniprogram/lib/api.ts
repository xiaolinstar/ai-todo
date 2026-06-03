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
  avatarUrl?: string;
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
  remindAt?: string;
  contacts?: ContactSummary[];
}

export interface CalendarEventSummary {
  id: string;
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  description?: string;
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

export interface ApiTokenSummary {
  id: string;
  name: string;
  scopes: string[];
  createdAt?: string;
  lastUsedAt?: string;
}

export interface CreateApiTokenResult {
  id: string;
  token: string;
  name: string;
  tokenType?: string;
  scopes: string[];
}

export interface ApiTokenListResult {
  items: ApiTokenSummary[];
}

export interface ContactListResult {
  items: ContactSummary[];
}

export interface NotificationSettings {
  wechatEnabled: boolean;
  defaultReminderEnabled: boolean;
  quietStart?: string;
  quietEnd?: string;
  wechatReminderTemplateId?: string;
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

function createIdempotencyKey(): string {
  const timestamp = Date.now().toString(36);
  const random = `${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`.slice(0, 16);
  return `miniapp-${timestamp}-${random}`;
}

export function request<T>(
  path: string,
  options: { method?: string; data?: object } = {}
): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    const method = options.method || "GET";
    const header = buildHeaders();
    if (method.toUpperCase() !== "GET") {
      header["Idempotency-Key"] = createIdempotencyKey();
    }

    wx.request({
      url: buildUrl(path),
      method,
      data: options.data,
      header,
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

export function updateProfile(input: { displayName?: string; avatarUrl?: string }) {
  return request<MeResult>("/v1/me/profile", {
    method: "PATCH",
    data: input
  });
}

export function completeReminder(reminderId: string) {
  return request<{ reminder: ReminderSummary }>(`/v1/reminders/${reminderId}/complete`, {
    method: "POST",
    data: {}
  });
}

export function deleteReminder(reminderId: string) {
  return request<{ id: string; deleted: boolean }>(`/v1/reminders/${reminderId}`, {
    method: "DELETE"
  });
}

export function createReminder(input: {
  title: string;
  notes?: string;
  dueAt?: string;
  remindAt?: string;
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
  description?: string;
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
  nickname?: string;
  company?: string;
  title?: string;
  notes?: string;
  methods?: Array<{ type: string; value: string; isPrimary?: boolean }>;
}) {
  return request<{ contact: ContactSummary }>("/v1/contacts", {
    method: "POST",
    data: input
  });
}

export function createPat(name: string) {
  return request<CreateApiTokenResult>("/v1/api-tokens", {
    method: "POST",
    data: { name, scopes: ["read", "write", "contact:read", "contact:write"] }
  });
}

export function listApiTokens() {
  return request<ApiTokenListResult>("/v1/api-tokens");
}

export function revokeApiToken(tokenId: string) {
  return request<{ id: string; revoked: boolean }>(`/v1/api-tokens/${tokenId}`, {
    method: "DELETE"
  });
}

export function revokeAllApiTokens() {
  return request<{ revokedCount: number }>("/v1/api-tokens/revoke-all", {
    method: "POST",
    data: {}
  });
}

export function fetchNotificationSettings() {
  return request<{ settings: NotificationSettings }>("/v1/notifications/settings");
}

export function recordWechatSubscriptionResult(input: {
  templateKey: string;
  templateId: string;
  result: "accept" | "reject" | "ban" | "filter";
  targetType?: "reminder";
  targetId?: string;
}) {
  return request<{ accepted: boolean; deliveryId?: string; status?: string; quotaRemaining: number }>(
    "/v1/notifications/wechat/subscription-result",
    {
      method: "POST",
      data: input
    }
  );
}
