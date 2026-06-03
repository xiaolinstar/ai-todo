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
  notes?: string;
  dueAt?: string;
  remindAt?: string;
  contacts?: ContactSummary[];
}

export interface ContactDetail extends ContactSummary {
  title?: string;
  notes?: string;
  methods?: Array<{ type: string; value: string; isPrimary?: boolean }>;
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

function buildHeaders(includeJsonContentType: boolean): Record<string, string> {
  const { token } = getConfig();
  const headers: Record<string, string> = {
    "x-client-source": "miniapp"
  };
  if (includeJsonContentType) {
    headers["content-type"] = "application/json";
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

function formatRequestError(err: unknown): string {
  if (err && typeof err === "object" && "errMsg" in err) {
    const errMsg = String((err as { errMsg: string }).errMsg);
    if (errMsg) return errMsg;
  }
  return "网络错误";
}

function parseApiErrorBody(body: unknown, statusCode: number): ApiResponse<never> | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const payload = body as Record<string, unknown>;
  if (payload.ok === false && payload.error) {
    return body as ApiResponse<never>;
  }
  const detail = payload.detail;
  if (detail && typeof detail === "object") {
    const nested = detail as Record<string, unknown>;
    if (nested.ok === false && nested.error) {
      return nested as unknown as ApiResponse<never>;
    }
  }
  if (typeof detail === "string" && detail.trim()) {
    return {
      ok: false,
      error: { code: "HTTP_ERROR", message: detail }
    };
  }
  if (statusCode === 404) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "接口不存在或资源未找到" }
    };
  }
  return null;
}

function normalizeSuccessBody<T>(body: unknown, statusCode: number): ApiResponse<T> {
  if (body && typeof body === "object") {
    const payload = body as Record<string, unknown>;
    if (payload.ok === true) {
      return body as ApiResponse<T>;
    }
    if ("data" in payload) {
      return { ok: true, data: payload.data as T };
    }
  }
  return {
    ok: false,
    error: { code: "INVALID_RESPONSE", message: `无法解析响应 (HTTP ${statusCode})` }
  };
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
  return new Promise((resolve) => {
    const method = (options.method || "GET").toUpperCase();
    const hasBody = options.data !== undefined && options.data !== null;
    const includeJsonContentType = hasBody && method !== "GET";
    const header = buildHeaders(includeJsonContentType);
    if (method !== "GET") {
      header["Idempotency-Key"] = createIdempotencyKey();
    }

    wx.request({
      url: buildUrl(path),
      method,
      header,
      ...(hasBody ? { data: options.data } : {}),
      success(res: { statusCode: number; data: unknown }) {
        if (res.statusCode >= 400) {
          const apiError = parseApiErrorBody(res.data, res.statusCode);
          if (apiError) {
            resolve(apiError);
            return;
          }
          resolve({
            ok: false,
            error: { code: "HTTP_ERROR", message: `HTTP ${res.statusCode}` }
          });
          return;
        }
        resolve(normalizeSuccessBody<T>(res.data, res.statusCode));
      },
      fail(err: unknown) {
        resolve({
          ok: false,
          error: { code: "NETWORK_ERROR", message: formatRequestError(err) }
        });
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

export function fetchReminder(reminderId: string) {
  return request<{ reminder: ReminderSummary }>(
    `/v1/reminders/${encodeURIComponent(reminderId)}`
  );
}

export function updateReminder(
  reminderId: string,
  input: {
    title?: string;
    notes?: string;
    dueAt?: string | null;
    remindAt?: string | null;
    contactIds?: string[];
  }
) {
  return request<{ reminder: ReminderSummary }>(
    `/v1/reminders/${encodeURIComponent(reminderId)}`,
    { method: "PATCH", data: input }
  );
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

export function fetchCalendarEvent(eventId: string) {
  return request<{ calendarEvent: CalendarEventSummary }>(
    `/v1/calendar/events/${encodeURIComponent(eventId)}`
  );
}

export function updateCalendarEvent(
  eventId: string,
  input: {
    title?: string;
    startAt?: string;
    endAt?: string | null;
    location?: string;
    description?: string;
    contactIds?: string[];
  }
) {
  return request<{ calendarEvent: CalendarEventSummary }>(
    `/v1/calendar/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", data: input }
  );
}

export function deleteCalendarEvent(eventId: string) {
  return request<{ id: string; deleted: boolean }>(
    `/v1/calendar/events/${encodeURIComponent(eventId.trim())}`,
    { method: "DELETE" }
  );
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

export function fetchContact(contactId: string) {
  return request<{ contact: ContactDetail }>(`/v1/contacts/${encodeURIComponent(contactId)}`);
}

export function updateContact(
  contactId: string,
  input: {
    displayName?: string;
    company?: string;
    title?: string;
    notes?: string;
    methods?: Array<{ type: string; value: string; isPrimary?: boolean }>;
  }
) {
  return request<{ contact: ContactDetail }>(`/v1/contacts/${encodeURIComponent(contactId)}`, {
    method: "PATCH",
    data: input
  });
}

export function deleteContact(contactId: string) {
  return request<{ id: string; deleted: boolean }>(
    `/v1/contacts/${encodeURIComponent(contactId.trim())}`,
    { method: "DELETE" }
  );
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

export interface HealthResult {
  service: string;
  status: string;
  apiVersion?: string;
  releaseTag?: string;
  gitSha?: string;
}

export function fetchHealth() {
  return request<HealthResult>("/v1/health");
}

export function fetchNotificationSettings() {
  return request<{ settings: NotificationSettings }>("/v1/notifications/settings");
}

export function updateNotificationSettings(input: {
  wechatEnabled?: boolean;
  defaultReminderEnabled?: boolean;
}) {
  return request<{ settings: NotificationSettings }>("/v1/notifications/settings", {
    method: "PUT",
    data: input
  });
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
