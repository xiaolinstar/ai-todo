import type {
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
  CreateReminderInput,
  CreateReminderResult,
  DeleteCalendarEventResult,
  DeleteReminderResult,
  ListCalendarEventsParams,
  ListRemindersParams,
  MeResult,
  ReminderDetailResult,
  ReminderListResult,
  RescheduleReminderInput,
  RescheduleReminderResult,
  TodayResult,
  UpdateCalendarEventInput,
  UpdateCalendarEventResult,
  UpdateContactInput,
  UpdateContactResult,
  UpdateReminderInput,
  UpdateReminderResult
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
    options: RequestOptions = {}
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
      headers
    });

    return (await response.json()) as ApiResponse<T>;
  }

  createReminder(input: CreateReminderInput): Promise<ApiResponse<CreateReminderResult>> {
    return this.request<CreateReminderResult>("/v1/reminders", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  completeReminder(reminderId: string): Promise<ApiResponse<CompleteReminderResult>> {
    return this.request<CompleteReminderResult>(`/v1/reminders/${reminderId}/complete`, {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  listReminders(params: ListRemindersParams = {}): Promise<ApiResponse<ReminderListResult>> {
    const search = new URLSearchParams();
    if (params.status) {
      search.set("status", params.status);
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
    const query = search.toString();
    return this.request<ReminderListResult>(`/v1/reminders${query ? `?${query}` : ""}`);
  }

  listRemindersToday(): Promise<ApiResponse<ReminderListResult>> {
    return this.request<ReminderListResult>("/v1/reminders/today");
  }

  getReminder(reminderId: string): Promise<ApiResponse<ReminderDetailResult>> {
    return this.request<ReminderDetailResult>(`/v1/reminders/${encodeURIComponent(reminderId)}`);
  }

  updateReminder(
    reminderId: string,
    input: UpdateReminderInput
  ): Promise<ApiResponse<UpdateReminderResult>> {
    return this.request<UpdateReminderResult>(`/v1/reminders/${encodeURIComponent(reminderId)}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }

  rescheduleReminder(
    reminderId: string,
    input: RescheduleReminderInput
  ): Promise<ApiResponse<RescheduleReminderResult>> {
    return this.request<RescheduleReminderResult>(
      `/v1/reminders/${encodeURIComponent(reminderId)}/reschedule`,
      {
        method: "POST",
        body: JSON.stringify(input)
      }
    );
  }

  deleteReminder(reminderId: string): Promise<ApiResponse<DeleteReminderResult>> {
    return this.request<DeleteReminderResult>(`/v1/reminders/${encodeURIComponent(reminderId)}`, {
      method: "DELETE"
    });
  }

  createCalendarEvent(
    input: CreateCalendarEventInput
  ): Promise<ApiResponse<CreateCalendarEventResult>> {
    return this.request<CreateCalendarEventResult>("/v1/calendar/events", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  listCalendarEvents(
    params: ListCalendarEventsParams = {}
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
    const query = search.toString();
    return this.request<CalendarEventListResult>(
      `/v1/calendar/events${query ? `?${query}` : ""}`
    );
  }

  listCalendarToday(): Promise<ApiResponse<CalendarEventListResult>> {
    return this.request<CalendarEventListResult>("/v1/calendar/today");
  }

  getCalendarEvent(eventId: string): Promise<ApiResponse<CalendarEventDetailResult>> {
    return this.request<CalendarEventDetailResult>(
      `/v1/calendar/events/${encodeURIComponent(eventId)}`
    );
  }

  updateCalendarEvent(
    eventId: string,
    input: UpdateCalendarEventInput
  ): Promise<ApiResponse<UpdateCalendarEventResult>> {
    return this.request<UpdateCalendarEventResult>(
      `/v1/calendar/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input)
      }
    );
  }

  deleteCalendarEvent(eventId: string): Promise<ApiResponse<DeleteCalendarEventResult>> {
    return this.request<DeleteCalendarEventResult>(
      `/v1/calendar/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" }
    );
  }

  me(): Promise<ApiResponse<MeResult>> {
    return this.request<MeResult>("/v1/me");
  }

  today(): Promise<ApiResponse<TodayResult>> {
    return this.request<TodayResult>("/v1/today");
  }

  createContact(input: CreateContactInput): Promise<ApiResponse<CreateContactResult>> {
    return this.request<CreateContactResult>("/v1/contacts", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  searchContacts(query?: string): Promise<ApiResponse<ContactListResult>> {
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    return this.request<ContactListResult>(`/v1/contacts${params}`);
  }

  getContact(contactId: string): Promise<ApiResponse<ContactDetailResult>> {
    return this.request<ContactDetailResult>(`/v1/contacts/${encodeURIComponent(contactId)}`);
  }

  updateContact(
    contactId: string,
    input: UpdateContactInput
  ): Promise<ApiResponse<UpdateContactResult>> {
    return this.request<UpdateContactResult>(`/v1/contacts/${encodeURIComponent(contactId)}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }

  createApiToken(input: CreateApiTokenInput): Promise<ApiResponse<CreateApiTokenResult>> {
    return this.request<CreateApiTokenResult>("/v1/api-tokens", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  issueDevPat(input: { name: string }): Promise<ApiResponse<CreateApiTokenResult>> {
    return this.request<CreateApiTokenResult>("/v1/auth/dev/issue-pat", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }
}
