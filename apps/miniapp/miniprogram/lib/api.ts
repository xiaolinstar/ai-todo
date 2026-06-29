import { getConfig } from './config';
import {
  AuthErrorCode,
  BizErrorCode,
  isUnauthorizedError,
  matchesValErrorCode,
  SysErrorCode,
  ValErrorCode,
} from './error-codes';
import { silentWechatReLogin } from './relogin';

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

export type WechatNotifyStatus =
  | 'none'
  | 'pending'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'no_quota'
  | 'skipped';

export interface ReminderSummary {
  id: string;
  title: string;
  status: string;
  notes?: string;
  dueAt?: string;
  remindAt?: string;
  source?: string;
  externalId?: string;
  sourceMeta?: Record<string, unknown>;
  wechatNotifyRequested?: boolean;
  wechatNotifyStatus?: WechatNotifyStatus;
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
  wechatNotifyRequested?: boolean;
  wechatNotifyStatus?: WechatNotifyStatus;
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
  tokenHint?: string;
  status: 'active' | 'expired' | 'revoked' | 'idle_revoked';
  expiresAt?: string;
  maxIdleDays?: number;
  createdAt?: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface CreateApiTokenResult {
  id: string;
  token: string;
  name: string;
  tokenType?: string;
  scopes: string[];
  tokenHint?: string;
  expiresAt?: string;
  maxIdleDays?: number;
}

export interface ApiTokenListResult {
  items: ApiTokenSummary[];
}

export interface ContactListResult {
  items: ContactSummary[];
  totalCount: number;
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface ReminderListResult {
  items: ReminderSummary[];
  totalCount: number;
  nextCursor?: string | null;
  hasMore?: boolean;
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
  return `${apiUrl.replace(/\/$/, '')}${path}`;
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== undefined && value !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });
  const query = parts.join('&');
  return query ? `?${query}` : '';
}

function buildHeaders(includeJsonContentType: boolean): Record<string, string> {
  const { token } = getConfig();
  const headers: Record<string, string> = {
    'x-client-source': 'miniapp',
  };
  if (includeJsonContentType) {
    headers['content-type'] = 'application/json';
  }
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

export function formatApiErrorMessage(error: ApiError | undefined, fallback: string): string {
  if (!error) {
    return fallback;
  }
  if (
    matchesValErrorCode(error.code, ValErrorCode.invalidInput) &&
    /validation failed/i.test(error.message)
  ) {
    return '服务端 API 版本过旧，请先部署 v0.8.0（API 0.4.0）';
  }
  return error.message || fallback;
}

function formatRequestError(err: unknown): string {
  if (err && typeof err === 'object' && 'errMsg' in err) {
    const errMsg = String((err as { errMsg: string }).errMsg);
    if (errMsg) return errMsg;
  }
  return '网络错误';
}

function parseApiErrorBody(body: unknown, statusCode: number): ApiResponse<never> | null {
  const authError =
    statusCode === 401 || statusCode === 403
      ? {
          ok: false as const,
          error: {
            code: AuthErrorCode.invalidToken,
            message: '请先登录后继续使用',
          },
        }
      : null;

  if (!body || typeof body !== 'object') {
    return authError;
  }
  const payload = body as Record<string, unknown>;
  if (payload.ok === false && payload.error) {
    const error = payload.error as Record<string, unknown>;
    if (
      statusCode === 401 ||
      statusCode === 403 ||
      isUnauthorizedError(typeof error.code === 'string' ? error.code : undefined)
    ) {
      return authError;
    }
    return body as ApiResponse<never>;
  }
  const detail = payload.detail;
  if (detail && typeof detail === 'object') {
    const nested = detail as Record<string, unknown>;
    if (nested.ok === false && nested.error) {
      const error = nested.error as Record<string, unknown>;
      if (
        statusCode === 401 ||
        statusCode === 403 ||
        isUnauthorizedError(typeof error.code === 'string' ? error.code : undefined)
      ) {
        return authError;
      }
      return nested as unknown as ApiResponse<never>;
    }
  }
  if (typeof detail === 'string' && detail.trim()) {
    return {
      ok: false,
      error: { code: SysErrorCode.httpError, message: detail },
    };
  }
  if (statusCode === 404) {
    return {
      ok: false,
      error: { code: BizErrorCode.notFound, message: '接口不存在或资源未找到' },
    };
  }
  return null;
}

function normalizeSuccessBody<T>(body: unknown, statusCode: number): ApiResponse<T> {
  if (body && typeof body === 'object') {
    const payload = body as Record<string, unknown>;
    if (payload.ok === true) {
      return body as ApiResponse<T>;
    }
    if ('data' in payload) {
      return { ok: true, data: payload.data as T };
    }
  }
  return {
    ok: false,
    error: { code: 'INVALID_RESPONSE', message: `无法解析响应 (HTTP ${statusCode})` },
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
  options: { method?: string; data?: object } = {},
  internalRetry = false,
): Promise<ApiResponse<T>> {
  return new Promise((resolve) => {
    const method = (options.method || 'GET').toUpperCase();
    const hasBody = options.data !== undefined && options.data !== null;
    const includeJsonContentType = hasBody && method !== 'GET';
    const header = buildHeaders(includeJsonContentType);
    if (method !== 'GET') {
      header['Idempotency-Key'] = createIdempotencyKey();
    }

    wx.request({
      url: buildUrl(path),
      method,
      header,
      ...(hasBody ? { data: options.data } : {}),
      success(res: { statusCode: number; data: unknown }) {
        const finish = (response: ApiResponse<T>) => {
          if (
            !internalRetry &&
            path !== '/v1/auth/wechat/login' &&
            getConfig().token &&
            !response.ok &&
            isUnauthorizedError(response.error?.code)
          ) {
            silentWechatReLogin().then((recovered) => {
              if (recovered) {
                request<T>(path, options, true).then(resolve);
                return;
              }
              resolve(response);
            });
            return;
          }
          resolve(response);
        };

        if (res.statusCode >= 400) {
          const apiError = parseApiErrorBody(res.data, res.statusCode);
          if (apiError) {
            finish(apiError as ApiResponse<T>);
            return;
          }
          finish({
            ok: false,
            error: { code: SysErrorCode.httpError, message: `HTTP ${res.statusCode}` },
          });
          return;
        }
        finish(normalizeSuccessBody<T>(res.data, res.statusCode));
      },
      fail(err: unknown) {
        resolve({
          ok: false,
          error: { code: 'NETWORK_ERROR', message: formatRequestError(err) },
        });
      },
    });
  });
}

export function fetchToday() {
  return request<TodayResult>('/v1/today');
}

export function fetchRemindersToday() {
  return request<{ items: ReminderSummary[] }>('/v1/reminders/today');
}

export function fetchReminders(params: {
  status?: string;
  sort?: 'created_at' | 'due_at' | 'completed_at';
  limit?: number;
}) {
  return request<ReminderListResult>(
    `/v1/reminders${buildQueryString({
      status: params.status,
      sort: params.sort,
      limit: params.limit !== undefined ? String(params.limit) : undefined,
    })}`,
  );
}

export function fetchCalendarToday() {
  return request<{ items: CalendarEventSummary[] }>('/v1/calendar/today');
}

export function fetchCalendarByDate(date: string) {
  return request<{ items: CalendarEventSummary[] }>(
    `/v1/calendar/events?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`,
  );
}

export function fetchMe() {
  return request<MeResult>('/v1/me');
}

export function updateProfile(input: {
  displayName?: string;
  avatarUrl?: string;
  timezone?: string;
}) {
  const data: Record<string, string> = {};
  if (input.displayName !== undefined) {
    data.displayName = input.displayName;
  }
  if (input.timezone !== undefined) {
    data.timezone = input.timezone;
  }
  const avatarUrl = (input.avatarUrl || '').trim();
  if (avatarUrl) {
    data.avatarUrl = avatarUrl;
  }
  return request<MeResult>('/v1/me/profile', {
    method: 'PATCH',
    data,
  });
}

export function completeReminder(reminderId: string) {
  return request<{ reminder: ReminderSummary }>(`/v1/reminders/${reminderId}/complete`, {
    method: 'POST',
    data: {},
  });
}

export function deleteReminder(reminderId: string) {
  return request<{ id: string; deleted: boolean }>(`/v1/reminders/${reminderId}`, {
    method: 'DELETE',
  });
}

export function fetchReminder(reminderId: string) {
  return request<{ reminder: ReminderSummary }>(`/v1/reminders/${encodeURIComponent(reminderId)}`);
}

export function updateReminder(
  reminderId: string,
  input: {
    title?: string;
    notes?: string;
    status?: string;
    dueAt?: string | null;
    remindAt?: string | null;
    wechatNotifyRequested?: boolean;
    contactIds?: string[];
  },
) {
  return request<{ reminder: ReminderSummary }>(`/v1/reminders/${encodeURIComponent(reminderId)}`, {
    method: 'PATCH',
    data: input,
  });
}

export function createReminder(input: {
  title: string;
  notes?: string;
  dueAt?: string;
  remindAt?: string;
  wechatNotifyRequested?: boolean;
  contactIds?: string[];
}) {
  return request<{ reminder: ReminderSummary }>('/v1/reminders', {
    method: 'POST',
    data: input,
  });
}

export function fetchCalendarEvent(eventId: string) {
  return request<{ calendarEvent: CalendarEventSummary }>(
    `/v1/calendar/events/${encodeURIComponent(eventId)}`,
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
    wechatNotifyRequested?: boolean;
    contactIds?: string[];
  },
) {
  return request<{ calendarEvent: CalendarEventSummary }>(
    `/v1/calendar/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', data: input },
  );
}

export function deleteCalendarEvent(eventId: string) {
  return request<{ id: string; deleted: boolean }>(
    `/v1/calendar/events/${encodeURIComponent(eventId.trim())}`,
    { method: 'DELETE' },
  );
}

export function createCalendarEvent(input: {
  title: string;
  startAt: string;
  endAt?: string;
  location?: string;
  description?: string;
  wechatNotifyRequested?: boolean;
  contactIds?: string[];
}) {
  return request<{ calendarEvent: CalendarEventSummary }>('/v1/calendar/events', {
    method: 'POST',
    data: input,
  });
}

export function searchContacts(query?: string) {
  const q = query ? `?q=${encodeURIComponent(query)}` : '';
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
  },
) {
  return request<{ contact: ContactDetail }>(`/v1/contacts/${encodeURIComponent(contactId)}`, {
    method: 'PATCH',
    data: input,
  });
}

export function deleteContact(contactId: string) {
  return request<{ id: string; deleted: boolean }>(
    `/v1/contacts/${encodeURIComponent(contactId.trim())}`,
    { method: 'DELETE' },
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
  return request<{ contact: ContactSummary }>('/v1/contacts', {
    method: 'POST',
    data: input,
  });
}

export function createPat(input: { name: string; expiresAt?: string; maxIdleDays?: number }) {
  return request<CreateApiTokenResult>('/v1/api-tokens', {
    method: 'POST',
    data: {
      name: input.name,
      expiresAt: input.expiresAt,
      maxIdleDays: input.maxIdleDays,
      scopes: ['read', 'write', 'contact:read', 'contact:write'],
    },
  });
}

export function listApiTokens() {
  return request<ApiTokenListResult>('/v1/api-tokens');
}

export function revokeApiToken(tokenId: string) {
  return request<{ id: string; revoked: boolean }>(`/v1/api-tokens/${tokenId}`, {
    method: 'DELETE',
  });
}

export function revokeAllApiTokens() {
  return request<{ revokedCount: number }>('/v1/api-tokens/revoke-all', {
    method: 'POST',
    data: {},
  });
}

export interface HealthResult {
  service: string;
  status: string;
  environment?: string;
  apiVersion?: string;
  releaseTag?: string;
  gitSha?: string;
}

export function fetchHealth() {
  return request<HealthResult>('/v1/health');
}

export function fetchNotificationSettings() {
  return request<{ settings: NotificationSettings }>('/v1/notifications/settings');
}

export function updateNotificationSettings(input: {
  wechatEnabled?: boolean;
  defaultReminderEnabled?: boolean;
  quietStart?: string | null;
  quietEnd?: string | null;
}) {
  return request<{ settings: NotificationSettings }>('/v1/notifications/settings', {
    method: 'PUT',
    data: input,
  });
}

export interface NotificationDeliverySummary {
  id: string;
  targetType: string;
  targetId: string;
  targetTitle: string;
  templateKey: string;
  scheduledAt: string;
  status: string;
  attemptCount: number;
  errorCode?: string;
  errorMessage?: string;
  sentAt?: string;
}

export function fetchNotificationStatus(limit = 10) {
  return request<{ items: NotificationDeliverySummary[] }>(
    `/v1/notifications/status?limit=${limit}`,
  );
}

export function recordWechatSubscriptionResult(input: {
  templateKey: string;
  templateId: string;
  result: 'accept' | 'reject' | 'ban' | 'filter';
  targetType?: 'reminder' | 'calendar_event';
  targetId?: string;
}) {
  return request<{
    accepted: boolean;
    deliveryId?: string;
    status?: string;
    quotaRemaining: number;
  }>('/v1/notifications/wechat/subscription-result', {
    method: 'POST',
    data: input,
  });
}
