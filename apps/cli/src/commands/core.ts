import type { CliContext } from "../context";
import { handleApi, persistApiUrl, readFlagValue } from "../context";
import { printAuthHint, resolveTokenSource } from "../auth";
import { clearToken, resolveApiUrl, saveSettings, settingsPath } from "../settings";
import { getCliVersion } from "../version";
import { AuthErrorCode } from "@ai-todo/shared";

function readLoginUrl(argv: string[]): string | undefined {
  return readFlagValue(argv, "--url") ?? readFlagValue(argv, "--api-url");
}

export async function runVersion(ctx: CliContext): Promise<void> {
  const cliVersion = getCliVersion();
  if (ctx.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          component: "cli",
          version: cliVersion,
          apiUrl: ctx.apiUrl
        },
        null,
        2
      )
    );
    return;
  }
  console.log(`ai-todo CLI ${cliVersion}`);
  console.log(`API: ${ctx.apiUrl}`);
}

export async function runLogin(ctx: CliContext, argv: string[]): Promise<void> {
  const apiUrl = readLoginUrl(argv) ?? ctx.apiUrl;
  persistApiUrl(apiUrl);

  const token = readFlagValue(argv, "--token");
  const issuePat = argv.includes("--issue-pat");
  const name = readFlagValue(argv, "--name") ?? "CLI Local";

  if (issuePat) {
    await issuePersonalAccessToken(ctx, apiUrl, name);
    return;
  }

  if (token) {
    saveSettings({ token, url: apiUrl });
  }

  const resolved = resolveTokenSource();

  if (ctx.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          apiUrl,
          settingsPath: settingsPath(),
          tokenSource: resolved.source,
          hasToken: resolved.source !== "none"
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Saved API URL: ${apiUrl}`);
  if (token) {
    console.log(`Wrote ${settingsPath()}`);
    console.log("You can now run ai-todo whoami, ai-todo today, and other commands without --url.");
    console.log("Agent environments can still override the settings file with AI_TODO_TOKEN.");
  } else if (resolved.source === "env") {
    console.log("Detected AI_TODO_TOKEN in the environment.");
  } else {
    printAuthHint("missing");
  }
  console.log(`Settings file: ${settingsPath()}`);
}

async function issuePersonalAccessToken(
  ctx: CliContext,
  apiUrl: string,
  name: string
): Promise<void> {
  if (!isLocalDevApiUrl(apiUrl)) {
    if (ctx.json) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            error: {
              code: "PAT_CREATE_NOT_SUPPORTED",
              message:
                "Create a Personal Access Token in the WeChat miniapp Mine tab, then write ~/.ai-todo/settings.json"
            }
          },
          null,
          2
        )
      );
    } else {
      console.error("The CLI cannot issue PATs against production or remote APIs.");
      console.error("Create one in the WeChat miniapp, then write it to ~/.ai-todo/settings.json.");
    }
    process.exitCode = 1;
    return;
  }

  const response = await ctx.client.issueDevPat({ name });

  if (!response.ok) {
    if (ctx.json) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.error(`[${response.error.code}] ${response.error.message}`);
      console.error("");
      console.error("Failed to issue a PAT. Confirm the API is running with AI_TODO_ALLOW_DEV_AUTH=true.");
    }
    process.exitCode = 1;
    return;
  }

  const { token, id, scopes } = response.data;
  saveSettings({ token, url: apiUrl });

  if (ctx.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          apiUrl,
          tokenId: id,
          token,
          scopes,
          savedTo: settingsPath(),
          envHint: `export AI_TODO_TOKEN=${token}`
        },
        null,
        2
      )
    );
    return;
  }

  console.log("Created a Personal Access Token. It is shown only once:");
  console.log("");
  console.log(token);
  console.log("");
  console.log("Recommended Agent environment variable:");
  console.log(`  export AI_TODO_TOKEN=${token}`);
  console.log("");
  console.log(`Also saved to ${settingsPath()}. Environment variables can override it.`);
}

export async function runLogout(ctx: CliContext): Promise<void> {
  clearToken();
  const resolved = resolveTokenSource();

  if (ctx.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          clearedSettings: true,
          tokenSource: resolved.source,
          note:
            resolved.source === "env"
              ? "AI_TODO_TOKEN is still active; unset AI_TODO_TOKEN to fully log out"
              : "The token in settings.json was cleared"
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Cleared the token in ${settingsPath()}`);
  if (resolved.source === "env") {
    console.log("Note: AI_TODO_TOKEN is still active in the environment.");
    console.log("Run unset AI_TODO_TOKEN to fully log out.");
  }
}

export async function runWhoami(ctx: CliContext): Promise<void> {
  const resolved = resolveTokenSource();
  if (resolved.source === "none") {
    if (ctx.json) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            error: {
              code: AuthErrorCode.invalidToken,
              message: "No API token configured."
            }
          },
          null,
          2
        )
      );
    } else {
      printAuthHint("missing");
    }
    process.exitCode = 1;
    return;
  }

  await handleApi(ctx, await ctx.client.me(), (data) => {
    if (!ctx.json) {
      const sourceLabel =
        resolved.source === "env"
          ? "AI_TODO_TOKEN environment variable"
          : `settings file ${settingsPath()}`;
      console.log(`${data.user.displayName} (${data.user.id})`);
      console.log(`API: ${resolveApiUrl()}`);
      console.log(`Timezone: ${data.user.timezone}`);
      console.log(`Auth source: ${sourceLabel}`);
    }
  });
}

export async function runToday(ctx: CliContext): Promise<void> {
  await handleApi(ctx, await ctx.client.today(), (data) => {
    if (ctx.json) {
      return;
    }
    console.log(`${data.date} (${data.timezone})`);
    console.log("Reminders:");
    if (data.reminders.length === 0) {
      console.log("  None");
    } else {
      for (const reminder of data.reminders) {
        console.log(`  - [${reminder.status}] ${reminder.title} (${reminder.id})`);
      }
    }
    console.log("Calendar:");
    if (data.calendarEvents.length === 0) {
      console.log("  None");
    } else {
      for (const event of data.calendarEvents) {
        const end = event.endAt ? ` - ${event.endAt}` : "";
        const place = event.location ? ` @ ${event.location}` : "";
        console.log(`  - ${event.title} (${event.startAt}${end})${place} (${event.id})`);
      }
    }
  });
}

declare const process: { exitCode?: number };

function isLocalDevApiUrl(apiUrl: string): boolean {
  try {
    const hostname = new URL(apiUrl).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}
