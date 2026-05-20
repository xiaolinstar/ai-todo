export interface AgentContactMatch {
  text: string;
  contactId?: string;
  confidence: number;
  needsConfirmation: boolean;
}

export interface AgentParsePreview {
  intent: "create_reminder" | "create_calendar_event" | "unknown";
  title?: string;
  dueAt?: string;
  startAt?: string;
  endAt?: string;
  contacts: AgentContactMatch[];
}

export interface AgentWriteOptions {
  idempotencyKey: string;
  requireConfirmation?: boolean;
}
