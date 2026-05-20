import type { CliContext } from "../context";
import { handleApi, persistApiUrl, readFlagValue } from "../context";
import { configPath, loadConfig, saveConfig } from "../config";

export async function runLogin(ctx: CliContext, argv: string[]): Promise<void> {
  const apiUrl = readFlagValue(argv, "--api-url") ?? ctx.apiUrl;
  persistApiUrl(apiUrl);
  const token = readFlagValue(argv, "--token");
  if (token) {
    saveConfig({ token, apiUrl });
  }

  if (ctx.json) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          apiUrl,
          configPath: configPath(),
          hasToken: Boolean(token ?? loadConfig().token),
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`已保存 API 地址：${apiUrl}`);
  if (token) {
    console.log("已保存 API Token（仅本地配置文件，请妥善保管）");
  }
  console.log(`配置文件：${configPath()}`);
}

export async function runWhoami(ctx: CliContext): Promise<void> {
  await handleApi(ctx, await ctx.client.me(), (data) => {
    if (!ctx.json) {
      console.log(`${data.user.displayName} (${data.user.id})`);
      console.log(`时区：${data.user.timezone}`);
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
