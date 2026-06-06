from ai_todo_api.cli_guidance import (
    CLI_BIN,
    CLI_NPM_INSTALL,
    CLI_SETTINGS_EXAMPLE,
    CLI_SETTINGS_PATH,
)


def preview_page() -> str:
    return f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ai-todo API</title>
    <style>
      :root {{
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f8fa;
        color: #20242a;
      }}
      body {{ margin: 0; }}
      main {{
        width: min(860px, calc(100% - 32px));
        margin: 48px auto;
      }}
      h1 {{
        margin: 0 0 8px;
        font-size: 32px;
        letter-spacing: 0;
      }}
      p {{ line-height: 1.7; }}
      section {{
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid #dde2ea;
      }}
      code, pre {{
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 14px;
      }}
      code {{
        padding: 2px 6px;
        border-radius: 6px;
        background: #eceff3;
      }}
      pre {{
        margin: 12px 0 0;
        padding: 12px 14px;
        border-radius: 8px;
        background: #eceff3;
        overflow-x: auto;
      }}
      a {{ color: #0969da; }}
      .status {{
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        font-weight: 600;
      }}
      .dot {{
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #2da44e;
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>ai-todo API</h1>
      <p>统一后端：微信小程序、CLI 与 Agent 共用同一套提醒、日历与联系人能力。</p>
      <div class="status"><span class="dot"></span>API ready</div>

      <section>
        <h2>健康检查</h2>
        <p><a href="/v1/health">/v1/health</a>：服务版本与部署信息</p>
        <p><a href="/v1/today">/v1/today</a>：今日提醒与日程（需 Bearer PAT）</p>
      </section>

      <section>
        <h2>CLI 安装</h2>
        <p>全局安装（npm 包名 <code>{CLI_NPM_INSTALL.split()[-1]}</code>，命令仍为 <code>{CLI_BIN}</code>）：</p>
        <pre><code>{CLI_NPM_INSTALL}</code></pre>
      </section>

      <section>
        <h2>CLI 配置</h2>
        <p>在小程序 <strong>我的 → CLI / Agent 访问令牌</strong> 创建 PAT，写入 <code>{CLI_SETTINGS_PATH}</code>：</p>
        <pre><code>{CLI_SETTINGS_EXAMPLE}</code></pre>
        <p>验证：<code>{CLI_BIN} whoami</code> · <code>{CLI_BIN} today --json</code></p>
      </section>
    </main>
  </body>
</html>"""
