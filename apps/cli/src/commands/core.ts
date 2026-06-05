import type { CliContext } from "../context";
import { handleApi, persistApiUrl, readFlagValue } from "../context";
import { printAuthHint, resolveTokenSource } from "../auth";
import { clearToken, resolveApiUrl, saveSettings, settingsPath } from "../settings";
import { getCliVersion } from "../version";

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

  console.log(`已保存 API 地址：${apiUrl}`);
  if (token) {
    console.log(`已写入 ${settingsPath()}`);
    console.log("后续直接运行 ai-todo whoami / ai-todo today 等命令即可，无需再传 --url。");
    console.log("Agent 环境仍可用 export AI_TODO_TOKEN=… 覆盖配置文件。");
  } else if (resolved.source === "env") {
    console.log("检测到 AI_TODO_TOKEN 环境变量（已生效）");
  } else {
    printAuthHint("missing");
  }
  console.log(`配置文件：${settingsPath()}`);
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
      console.error("生产/远程 API 不支持 CLI 直接签发 PAT。");
      console.error("请在微信小程序「我的 → CLI / Agent 访问令牌」中创建，然后写入 ~/.ai-todo/settings.json。");
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
      console.error("签发 PAT 失败。请确认 API 已启动且 AI_TODO_ALLOW_DEV_AUTH=true。");
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

  console.log("已签发 Personal Access Token（仅显示一次，请妥善保管）：");
  console.log("");
  console.log(token);
  console.log("");
  console.log("推荐写入 Agent 环境变量：");
  console.log(`  export AI_TODO_TOKEN=${token}`);
  console.log("");
  console.log(`已同时保存到 ${settingsPath()}（可被环境变量覆盖）`);
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
              ? "AI_TODO_TOKEN 环境变量仍生效；unset AI_TODO_TOKEN 可完全退出"
              : "settings.json 中的 token 已清除"
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`已清除 ${settingsPath()} 中的 token`);
  if (resolved.source === "env") {
    console.log("注意：AI_TODO_TOKEN 环境变量仍然生效");
    console.log("运行 unset AI_TODO_TOKEN 可完全退出授权");
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
              code: "UNAUTHORIZED",
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
          ? "环境变量 AI_TODO_TOKEN"
          : `配置文件 ${settingsPath()}`;
      console.log(`${data.user.displayName} (${data.user.id})`);
      console.log(`API：${resolveApiUrl()}`);
      console.log(`时区：${data.user.timezone}`);
      console.log(`授权来源：${sourceLabel}`);
    }
  });
}

export async function runProfileUpdate(ctx: CliContext, argv: string[]): Promise<void> {
  const displayName = readFlagValue(argv, "--name") ?? readFlagValue(argv, "--display-name");
  const avatarUrl = readFlagValue(argv, "--avatar-url");

  if (!displayName && avatarUrl === undefined) {
    console.error("Usage: ai-todo profile update --name <text> [--avatar-url <url>]");
    process.exitCode = 1;
    return;
  }

  await handleApi(
    ctx,
    await ctx.client.updateProfile({
      displayName,
      avatarUrl
    }),
    (data) => {
      if (!ctx.json) {
        console.log(`已更新个人资料：${data.user.displayName} (${data.user.id})`);
        if (data.user.avatarUrl) {
          console.log(`头像：${data.user.avatarUrl}`);
        }
      }
    }
  );
}

export async function runToday(ctx: CliContext): Promise<void> {
  await handleApi(ctx, await ctx.client.today(), (data) => {
    if (ctx.json) {
      return;
    }
    console.log(`${data.date} (${data.timezone})`);
    console.log("提醒：");
    if (data.reminders.length === 0) {
      console.log("  暂无");
    } else {
      for (const reminder of data.reminders) {
        console.log(`  - [${reminder.status}] ${reminder.title} (${reminder.id})`);
      }
    }
    console.log("日程：");
    if (data.calendarEvents.length === 0) {
      console.log("  暂无");
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
