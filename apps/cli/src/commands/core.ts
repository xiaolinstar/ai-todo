import type { CliContext } from "../context";
import { handleApi, persistApiUrl, readFlagValue } from "../context";
import { printAuthHint, resolveTokenSource } from "../auth";
import { clearToken, configPath, saveConfig } from "../config";

export async function runLogin(ctx: CliContext, argv: string[]): Promise<void> {
  const apiUrl = readFlagValue(argv, "--api-url") ?? ctx.apiUrl;
  persistApiUrl(apiUrl);

  const token = readFlagValue(argv, "--token");
  const issuePat = argv.includes("--issue-pat");
  const name = readFlagValue(argv, "--name") ?? "CLI Local";

  if (issuePat) {
    await issuePersonalAccessToken(ctx, apiUrl, name);
    return;
  }

  if (token) {
    saveConfig({ token, apiUrl });
  }

  const resolved = resolveTokenSource();

  if (ctx.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          apiUrl,
          configPath: configPath(),
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
    console.log("已保存 API Token 到本地配置文件");
    console.log("提示：Agent 环境更推荐 export AI_TODO_TOKEN=…（优先级高于配置文件）");
  } else if (resolved.source === "env") {
    console.log("检测到 AI_TODO_TOKEN 环境变量（已生效）");
  } else {
    printAuthHint("missing");
  }
  console.log(`配置文件：${configPath()}`);
}

async function issuePersonalAccessToken(
  ctx: CliContext,
  apiUrl: string,
  name: string
): Promise<void> {
  const response = await ctx.client.createApiToken({ name });

  if (!response.ok) {
    if (ctx.json) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.error(`[${response.error.code}] ${response.error.message}`);
      console.error("");
      console.error("签发 PAT 需要已有授权（dev 旁路或有效 Token）。");
      printAuthHint("missing");
    }
    process.exitCode = 1;
    return;
  }

  const { token, id, scopes } = response.data;
  saveConfig({ token, apiUrl });

  if (ctx.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          apiUrl,
          tokenId: id,
          token,
          scopes,
          savedTo: configPath(),
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
  console.log(`已同时保存到 ${configPath()}（可被环境变量覆盖）`);
}

export async function runLogout(ctx: CliContext): Promise<void> {
  clearToken();
  const resolved = resolveTokenSource();

  if (ctx.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          clearedConfig: true,
          tokenSource: resolved.source,
          note:
            resolved.source === "env"
              ? "AI_TODO_TOKEN 环境变量仍生效；unset AI_TODO_TOKEN 可完全退出"
              : "本地 Token 已清除"
        },
        null,
        2
      )
    );
    return;
  }

  console.log("已清除 ~/.ai-todo/config.json 中的 Token");
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
        resolved.source === "env" ? "环境变量 AI_TODO_TOKEN" : "本地配置文件";
      console.log(`${data.user.displayName} (${data.user.id})`);
      console.log(`时区：${data.user.timezone}`);
      console.log(`授权来源：${sourceLabel}`);
    }
  });
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
