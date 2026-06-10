export type EntityId = string;

export type ClientSource = "miniapp" | "cli" | "agent" | "api";

export type ReminderStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type ContactMethodType = "email" | "phone" | "wechat" | "other";

export interface ContactSummary {
  id: EntityId;
  handle: string;
  displayName: string;
  nickname?: string;
  company?: string;
  title?: string;
  primaryEmail?: string;
  primaryPhone?: string;
}

export interface ContactMethodInput {
  type: ContactMethodType;
  value: string;
  label?: string;
  isPrimary?: boolean;
}

export interface ContactMethodSummary {
  id: EntityId;
  type: ContactMethodType;
  label?: string;
  value: string;
  isPrimary: boolean;
}

export interface ContactDetail extends ContactSummary {
  linkedUserId?: EntityId;
  handleSource: "generated" | "manual" | string;
  notes?: string;
  methods: ContactMethodSummary[];
  aliases: string[];
}

export interface CreateContactInput {
  displayName: string;
  handle?: string;
  nickname?: string;
  company?: string;
  title?: string;
  notes?: string;
  methods?: ContactMethodInput[];
  aliases?: string[];
}

export interface CreateContactResult {
  contact: ContactDetail;
}

export interface ContactListResult {
  items: ContactSummary[];
  totalCount: number;
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface SearchContactsParams {
  query?: string;
  limit?: number;
  cursor?: string;
}

export interface ContactDetailResult {
  contact: ContactDetail;
}

export interface UpdateContactInput {
  displayName?: string;
  handle?: string;
  nickname?: string;
  company?: string;
  title?: string;
  notes?: string;
  methods?: ContactMethodInput[];
  aliases?: string[];
}

export interface UpdateContactResult {
  contact: ContactDetail;
}

export interface DeleteContactResult {
  id: EntityId;
  deleted: boolean;
}

export interface CreateApiTokenInput {
  name: string;
  scopes?: string[];
  expiresAt?: string;
  maxIdleDays?: number;
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

export type ApiTokenStatus = "active" | "expired" | "revoked" | "idle_revoked";

export interface ApiTokenSummary {
  id: string;
  name: string;
  scopes: string[];
  tokenHint?: string;
  status: ApiTokenStatus;
  expiresAt?: string;
  maxIdleDays?: number;
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export interface ApiTokenListResult {
  items: ApiTokenSummary[];
}

export interface RevokeApiTokenResult {
  id: string;
  revoked: boolean;
}

export interface RevokeAllApiTokensResult {
  revokedCount: number;
}

export interface ReminderSummary {
  id: EntityId;
  title: string;
  status: ReminderStatus;
  notes?: string;
  dueAt?: string;
  remindAt?: string;
  source?: string;
  externalId?: string;
  sourceMeta?: Record<string, unknown>;
  completedAt?: string;
  contacts?: ContactSummary[];
}

export interface CreateReminderInput {
  title: string;
  notes?: string;
  dueAt?: string;
  remindAt?: string;
  source?: string;
  externalId?: string;
  sourceMeta?: Record<string, unknown>;
  contactIds?: EntityId[];
}

export interface CreateReminderResult {
  reminder: ReminderSummary;
  created?: boolean;
}

export interface CompleteReminderResult {
  reminder: ReminderSummary;
}

export interface ReminderListResult {
  items: ReminderSummary[];
  totalCount: number;
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface ReminderDetailResult {
  reminder: ReminderSummary;
}

export interface UpdateReminderInput {
  title?: string;
  notes?: string;
  status?: ReminderStatus;
  dueAt?: string;
  remindAt?: string;
  contactIds?: EntityId[];
}

export interface RescheduleReminderInput {
  dueAt?: string;
  remindAt?: string;
}

export interface UpdateReminderResult {
  reminder: ReminderSummary;
}

export interface RescheduleReminderResult {
  reminder: ReminderSummary;
}

export interface DeleteReminderResult {
  id: EntityId;
  deleted: boolean;
}

export interface ListRemindersParams {
  status?: ReminderStatus;
  source?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
  sort?: "created_at" | "due_at" | "completed_at";
}

export interface UserSummary {
  id: EntityId;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  timezone: string;
}

export interface MeResult {
  user: UserSummary;
}

export interface UpdateProfileInput {
  displayName?: string;
  avatarUrl?: string;
  timezone?: string;
}

export interface UpdateProfileResult {
  user: UserSummary;
}

export interface TodayResult {
  date: string;
  timezone: string;
  reminders: ReminderSummary[];
  calendarEvents: CalendarEventSummary[];
}

export interface CalendarEventSummary {
  id: EntityId;
  title: string;
  startAt: string;
  endAt?: string;
  timezone: string;
  location?: string;
  description?: string;
  contacts?: ContactSummary[];
}

export interface CreateCalendarEventInput {
  title: string;
  startAt: string;
  endAt?: string;
  timezone?: string;
  location?: string;
  description?: string;
  contactIds?: EntityId[];
}

export interface CreateCalendarEventResult {
  calendarEvent: CalendarEventSummary;
}

export interface CalendarEventListResult {
  items: CalendarEventSummary[];
  totalCount: number;
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface CalendarEventDetailResult {
  calendarEvent: CalendarEventSummary;
}

export interface UpdateCalendarEventInput {
  title?: string;
  startAt?: string;
  endAt?: string;
  timezone?: string;
  location?: string;
  description?: string;
  contactIds?: EntityId[];
}

export interface UpdateCalendarEventResult {
  calendarEvent: CalendarEventSummary;
}

export interface DeleteCalendarEventResult {
  id: EntityId;
  deleted: boolean;
}

export interface ListCalendarEventsParams {
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      requestId?: string;
    }
  | {
      ok: false;
      error: ApiError;
      requestId?: string;
    };
