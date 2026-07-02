import type {
  AddTrackEntryInput,
  AddTrackEntryResult,
  ApiResponse,
  CalendarEventDetailResult,
  CalendarEventListResult,
  CompleteReminderResult,
  ContactDetailResult,
  ContactListResult,
  CreateCalendarEventInput,
  CreateCalendarEventResult,
  CreateContactInput,
  CreateContactResult,
  CreateApiTokenInput,
  CreateApiTokenResult,
  CreateTagInput,
  CreateReminderInput,
  CreateReminderResult,
  DeleteCalendarEventResult,
  DeleteContactResult,
  DeleteReminderResult,
  DeleteTagResult,
  ListCalendarEventsParams,
  ListRemindersParams,
  ListTagsParams,
  MeResult,
  ApiTokenListResult,
  ReminderDetailResult,
  ReminderListResult,
  RevokeAllApiTokensResult,
  RevokeApiTokenResult,
  SearchContactsParams,
  RescheduleReminderInput,
  RescheduleReminderResult,
  TodayResult,
  TagDetailResult,
  TagListResult,
  UpdateCalendarEventInput,
  UpdateCalendarEventResult,
  UpdateContactInput,
  UpdateContactResult,
  UpdateProfileInput,
  UpdateProfileResult,
  UpdateReminderInput,
  UpdateReminderResult,
  UpdateTagInput,
} from "@ai-todo/shared";

export interface AiTodoClientOptions {
  apiUrl: string;
  token?: string;
  source?: "miniapp" | "cli" | "agent" | "api";
  idempotencyKey?: string;
}

export interface RequestOptions {
  idempotencyKey?: string;
}

export class AiTodoClient {
  private readonly apiUrl: string;
  private readonly token?: string;
  private readonly source?: string;
  private readonly defaultIdempotencyKey?: string;

  constructor(options: AiTodoClientOptions) {
    this.apiUrl = options.apiUrl.replace(/\/$/, "");
    this.token = options.token;
    this.source = options.source;
    this.defaultIdempotencyKey = options.idempotencyKey;
  }

  async request<T>(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");

    if (this.token) {
      headers.set("authorization", `Bearer ${this.token}`);
    }

    if (this.source) {
      headers.set("x-client-source", this.source);
    }

    const idempotencyKey = options.idempotencyKey ?? this.defaultIdempotencyKey;
    if (idempotencyKey) {
      headers.set("idempotency-key", idempotencyKey);
    }

    const response = await fetch(`${this.apiUrl}${path}`, {
      ...init,
      headers,
    });

    return (await response.json()) as ApiResponse<T>;
  }

  createReminder(
    input: CreateReminderInput,
  ): Promise<ApiResponse<CreateReminderResult>> {
    return this.request<CreateReminderResult>("/v1/reminders", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  completeReminder(
    reminderId: string,
  ): Promise<ApiResponse<CompleteReminderResult>> {
    return this.request<CompleteReminderResult>(
      `/v1/reminders/${reminderId}/complete`,
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
  }

  listReminders(
    params: ListRemindersParams = {},
  ): Promise<ApiResponse<ReminderListResult>> {
    const search = new URLSearchParams();
    if (params.status) {
      search.set("status", params.status);
    }
    if (params.source) {
      search.set("source", params.source);
    }
    if (params.q) {
      search.set("q", params.q);
    }
    if (params.tag) {
      search.set("tag", params.tag);
    }
    if (params.from) {
      search.set("from", params.from);
    }
    if (params.to) {
      search.set("to", params.to);
    }
    if (params.limit) {
      search.set("limit", String(params.limit));
    }
    if (params.cursor) {
      search.set("cursor", params.cursor);
    }
    if (params.sort) {
      search.set("sort", params.sort);
    }
    const query = search.toString();
    return this.request<ReminderListResult>(
      `/v1/reminders${query ? `?${query}` : ""}`,
    );
  }

  findReminderBySource(
    source: string,
    externalId: string,
  ): Promise<ApiResponse<ReminderDetailResult>> {
    const search = new URLSearchParams();
    search.set("source", source);
    search.set("externalId", externalId);
    return this.request<ReminderDetailResult>(
      `/v1/reminders/lookup?${search.toString()}`,
    );
  }

  listRemindersToday(): Promise<ApiResponse<ReminderListResult>> {
    return this.request<ReminderListResult>("/v1/reminders/today");
  }

  getReminder(reminderId: string): Promise<ApiResponse<ReminderDetailResult>> {
    return this.request<ReminderDetailResult>(
      `/v1/reminders/${encodeURIComponent(reminderId)}`,
    );
  }

  updateReminder(
    reminderId: string,
    input: UpdateReminderInput,
  ): Promise<ApiResponse<UpdateReminderResult>> {
    return this.request<UpdateReminderResult>(
      `/v1/reminders/${encodeURIComponent(reminderId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  }

  rescheduleReminder(
    reminderId: string,
    input: RescheduleReminderInput,
  ): Promise<ApiResponse<RescheduleReminderResult>> {
    return this.request<RescheduleReminderResult>(
      `/v1/reminders/${encodeURIComponent(reminderId)}/reschedule`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  deleteReminder(
    reminderId: string,
  ): Promise<ApiResponse<DeleteReminderResult>> {
    return this.request<DeleteReminderResult>(
      `/v1/reminders/${encodeURIComponent(reminderId)}`,
      {
        method: "DELETE",
      },
    );
  }

  addReminderTrackEntry(
    reminderId: string,
    input: AddTrackEntryInput,
  ): Promise<ApiResponse<AddTrackEntryResult>> {
    return this.request<AddTrackEntryResult>(
      `/v1/reminders/${encodeURIComponent(reminderId)}/track-entries`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  }

  listTags(params: ListTagsParams = {}): Promise<ApiResponse<TagListResult>> {
    const search = new URLSearchParams();
    if (params.q) {
      search.set("q", params.q);
    }
    if (params.limit !== undefined) {
      search.set("limit", String(params.limit));
    }
    const query = search.toString();
    return this.request<TagListResult>(`/v1/tags${query ? `?${query}` : ""}`);
  }

  createTag(input: CreateTagInput): Promise<ApiResponse<TagDetailResult>> {
    return this.request<TagDetailResult>("/v1/tags", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  updateTag(tagId: string, input: UpdateTagInput): Promise<ApiResponse<TagDetailResult>> {
    return this.request<TagDetailResult>(`/v1/tags/${encodeURIComponent(tagId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  deleteTag(tagId: string): Promise<ApiResponse<DeleteTagResult>> {
    return this.request<DeleteTagResult>(`/v1/tags/${encodeURIComponent(tagId)}`, {
      method: "DELETE",
    });
  }

  createCalendarEvent(
    input: CreateCalendarEventInput,
  ): Promise<ApiResponse<CreateCalendarEventResult>> {
    return this.request<CreateCalendarEventResult>("/v1/calendar/events", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  listCalendarEvents(
    params: ListCalendarEventsParams = {},
  ): Promise<ApiResponse<CalendarEventListResult>> {
    const search = new URLSearchParams();
    if (params.from) {
      search.set("from", params.from);
    }
    if (params.to) {
      search.set("to", params.to);
    }
    if (params.limit) {
      search.set("limit", String(params.limit));
    }
    if (params.cursor) {
      search.set("cursor", params.cursor);
    }
    const query = search.toString();
    return this.request<CalendarEventListResult>(
      `/v1/calendar/events${query ? `?${query}` : ""}`,
    );
  }

  listCalendarToday(): Promise<ApiResponse<CalendarEventListResult>> {
    return this.request<CalendarEventListResult>("/v1/calendar/today");
  }

  getCalendarEvent(
    eventId: string,
  ): Promise<ApiResponse<CalendarEventDetailResult>> {
    return this.request<CalendarEventDetailResult>(
      `/v1/calendar/events/${encodeURIComponent(eventId)}`,
    );
  }

  updateCalendarEvent(
    eventId: string,
    input: UpdateCalendarEventInput,
  ): Promise<ApiResponse<UpdateCalendarEventResult>> {
    return this.request<UpdateCalendarEventResult>(
      `/v1/calendar/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  }

  deleteCalendarEvent(
    eventId: string,
  ): Promise<ApiResponse<DeleteCalendarEventResult>> {
    return this.request<DeleteCalendarEventResult>(
      `/v1/calendar/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );
  }

  me(): Promise<ApiResponse<MeResult>> {
    return this.request<MeResult>("/v1/me");
  }

  updateProfile(
    input: UpdateProfileInput,
  ): Promise<ApiResponse<UpdateProfileResult>> {
    return this.request<UpdateProfileResult>("/v1/me/profile", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  today(): Promise<ApiResponse<TodayResult>> {
    return this.request<TodayResult>("/v1/today");
  }

  createContact(
    input: CreateContactInput,
  ): Promise<ApiResponse<CreateContactResult>> {
    return this.request<CreateContactResult>("/v1/contacts", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  searchContacts(
    params: SearchContactsParams = {},
  ): Promise<ApiResponse<ContactListResult>> {
    const search = new URLSearchParams();
    if (params.query) {
      search.set("q", params.query);
    }
    if (params.limit !== undefined) {
      search.set("limit", String(params.limit));
    }
    if (params.cursor) {
      search.set("cursor", params.cursor);
    }
    const query = search.toString();
    return this.request<ContactListResult>(
      `/v1/contacts${query ? `?${query}` : ""}`,
    );
  }

  getContact(contactId: string): Promise<ApiResponse<ContactDetailResult>> {
    return this.request<ContactDetailResult>(
      `/v1/contacts/${encodeURIComponent(contactId)}`,
    );
  }

  updateContact(
    contactId: string,
    input: UpdateContactInput,
  ): Promise<ApiResponse<UpdateContactResult>> {
    return this.request<UpdateContactResult>(
      `/v1/contacts/${encodeURIComponent(contactId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  }

  deleteContact(contactId: string): Promise<ApiResponse<DeleteContactResult>> {
    return this.request<DeleteContactResult>(
      `/v1/contacts/${encodeURIComponent(contactId)}`,
      {
        method: "DELETE",
      },
    );
  }

  createApiToken(
    input: CreateApiTokenInput,
  ): Promise<ApiResponse<CreateApiTokenResult>> {
    return this.request<CreateApiTokenResult>("/v1/api-tokens", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  listApiTokens(): Promise<ApiResponse<ApiTokenListResult>> {
    return this.request<ApiTokenListResult>("/v1/api-tokens");
  }

  revokeApiToken(tokenId: string): Promise<ApiResponse<RevokeApiTokenResult>> {
    return this.request<RevokeApiTokenResult>(
      `/v1/api-tokens/${encodeURIComponent(tokenId)}`,
      {
        method: "DELETE",
      },
    );
  }

  revokeAllApiTokens(): Promise<ApiResponse<RevokeAllApiTokensResult>> {
    return this.request<RevokeAllApiTokensResult>("/v1/api-tokens/revoke-all", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  issueDevPat(input: {
    name: string;
  }): Promise<ApiResponse<CreateApiTokenResult>> {
    return this.request<CreateApiTokenResult>("/v1/auth/dev/issue-pat", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
}
