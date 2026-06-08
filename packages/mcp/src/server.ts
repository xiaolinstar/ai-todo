import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveAuthError } from "./auth";
import { formatToolResult, runAiTodoCli } from "./cli-bridge";

const MCP_VERSION = "0.1.0";

const statusSchema = z.enum(["pending", "completed", "cancelled"]).optional();

function appendContacts(args: string[], contactIds?: string[]): string[] {
  if (!contactIds?.length) {
    return args;
  }
  for (const id of contactIds) {
    args.push("--contact", id);
  }
  return args;
}

function appendIdempotency(args: string[], idempotencyKey?: string): string[] {
  if (idempotencyKey?.trim()) {
    args.push("--idempotency-key", idempotencyKey.trim());
  }
  return args;
}

async function invoke(args: string[]) {
  const authError = resolveAuthError();
  if (authError) {
    return {
      content: [{ type: "text" as const, text: authError }],
      isError: true
    };
  }
  const result = await runAiTodoCli(args);
  return formatToolResult(result);
}

type ToolHandlerResult = Awaited<ReturnType<typeof invoke>>;

type RegisterAiTodoTool = (
  name: string,
  config: { description: string; inputSchema?: Record<string, z.ZodTypeAny> },
  handler: (args: any) => ToolHandlerResult | Promise<ToolHandlerResult>
) => void;

/** Avoid TS2589 from deep Zod inference across many registerTool calls. */
function registerAiTodoTool(server: McpServer, ...args: Parameters<RegisterAiTodoTool>): void {
  const register = server.registerTool as unknown as RegisterAiTodoTool;
  register(...args);
}

export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "ai-todo", version: MCP_VERSION });

  registerAiTodoTool(
    server,
    "whoami",
    { description: "Get current user id, display name, and timezone." },
    async () => invoke(["whoami"])
  );

  registerAiTodoTool(
    server,
    "today",
    { description: "List today's pending reminders and calendar events." },
    async () => invoke(["today"])
  );

  registerAiTodoTool(
    server,
    "reminder_find",
    {
      description:
        "Look up a reminder by business source and external id (idempotent read before create/update).",
      inputSchema: {
        source: z.string().min(1).describe("Business source slug, e.g. email, jira"),
        external_id: z.string().min(1).describe("Stable external key, e.g. email Message-ID")
      }
    },
    async ({ source, external_id }) =>
      invoke(["reminder", "find", "--source", source, "--external-id", external_id])
  );

  registerAiTodoTool(
    server,
    "reminder_create",
    {
      description: "Create a reminder without an external source key.",
      inputSchema: {
        title: z.string().min(1),
        due: z.string().optional().describe("ISO-8601 datetime with timezone"),
        notes: z.string().optional(),
        contact_ids: z.array(z.string()).optional(),
        idempotency_key: z.string().optional()
      }
    },
    async ({ title, due, notes, contact_ids, idempotency_key }) => {
      const args = appendIdempotency(
        appendContacts(["reminder", "create", "--title", title], contact_ids),
        idempotency_key
      );
      if (due) args.push("--due", due);
      if (notes !== undefined) args.push("--notes", notes);
      return invoke(args);
    }
  );

  registerAiTodoTool(
    server,
    "reminder_create_sourced",
    {
      description:
        "Create a reminder keyed by source + external_id. Returns created=false if the pair already exists.",
      inputSchema: {
        title: z.string().min(1),
        source: z.string().min(1),
        external_id: z.string().min(1),
        due: z.string().optional(),
        notes: z.string().optional(),
        source_meta: z.string().optional().describe("JSON object string for audit metadata"),
        contact_ids: z.array(z.string()).optional(),
        idempotency_key: z.string().optional()
      }
    },
    async ({ title, source, external_id, due, notes, source_meta, contact_ids, idempotency_key }) => {
      const args = appendIdempotency(
        appendContacts(
          ["reminder", "create", "--title", title, "--source", source, "--external-id", external_id],
          contact_ids
        ),
        idempotency_key
      );
      if (due) args.push("--due", due);
      if (notes !== undefined) args.push("--notes", notes);
      if (source_meta) args.push("--source-meta", source_meta);
      return invoke(args);
    }
  );

  registerAiTodoTool(
    server,
    "reminder_list",
    {
      description: "List reminders; optional status filter.",
      inputSchema: {
        status: statusSchema
      }
    },
    async ({ status }) => {
      const args = ["reminder", "list"];
      if (status) args.push("--status", status);
      return invoke(args);
    }
  );

  registerAiTodoTool(
    server,
    "reminder_list_by_source",
    {
      description: "List reminders filtered by business source.",
      inputSchema: {
        source: z.string().min(1),
        status: statusSchema
      }
    },
    async ({ source, status }) => {
      const args = ["reminder", "list", "--source", source];
      if (status) args.push("--status", status);
      return invoke(args);
    }
  );

  registerAiTodoTool(
    server,
    "reminder_update_by_source",
    {
      description: "Update a reminder located by source + external_id.",
      inputSchema: {
        source: z.string().min(1),
        external_id: z.string().min(1),
        title: z.string().optional(),
        notes: z.string().optional(),
        due: z.string().optional(),
        remind: z.string().optional(),
        contact_ids: z.array(z.string()).optional(),
        idempotency_key: z.string().optional()
      }
    },
    async ({ source, external_id, title, notes, due, remind, contact_ids, idempotency_key }) => {
      const args = appendIdempotency(
        appendContacts(["reminder", "update", "--source", source, "--external-id", external_id], contact_ids),
        idempotency_key
      );
      if (title) args.push("--title", title);
      if (notes !== undefined) args.push("--notes", notes);
      if (due) args.push("--due", due);
      if (remind) args.push("--remind", remind);
      return invoke(args);
    }
  );

  registerAiTodoTool(
    server,
    "reminder_complete_by_source",
    {
      description: "Mark a reminder completed by source + external_id.",
      inputSchema: {
        source: z.string().min(1),
        external_id: z.string().min(1),
        idempotency_key: z.string().optional()
      }
    },
    async ({ source, external_id, idempotency_key }) =>
      invoke(
        appendIdempotency(
          ["reminder", "done", "--source", source, "--external-id", external_id],
          idempotency_key
        )
      )
  );

  registerAiTodoTool(
    server,
    "contact_search",
    {
      description: "Search contacts by name or alias.",
      inputSchema: {
        query: z.string().min(1)
      }
    },
    async ({ query }) => invoke(["contact", "search", query])
  );

  registerAiTodoTool(
    server,
    "calendar_today",
    { description: "List calendar events for today." },
    async () => invoke(["calendar", "today"])
  );

  registerAiTodoTool(
    server,
    "calendar_create",
    {
      description: "Create a calendar event.",
      inputSchema: {
        title: z.string().min(1),
        start: z.string().min(1).describe("ISO-8601 start time"),
        end: z.string().optional(),
        location: z.string().optional(),
        contact_ids: z.array(z.string()).optional(),
        idempotency_key: z.string().optional()
      }
    },
    async ({ title, start, end, location, contact_ids, idempotency_key }) => {
      const args = appendIdempotency(
        appendContacts(["calendar", "add", "--title", title, "--start", start], contact_ids),
        idempotency_key
      );
      if (end) args.push("--end", end);
      if (location) args.push("--location", location);
      return invoke(args);
    }
  );

  return server;
}

export async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
