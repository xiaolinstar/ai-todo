def preview_page() -> str:
    return """<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ai-todo Dev Preview</title>
    <style>
      :root {
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f8fa;
        color: #20242a;
      }
      body { margin: 0; }
      main {
        width: min(860px, calc(100% - 32px));
        margin: 48px auto;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 32px;
        letter-spacing: 0;
      }
      p { line-height: 1.7; }
      section {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid #dde2ea;
      }
      code {
        padding: 2px 6px;
        border-radius: 6px;
        background: #eceff3;
      }
      a { color: #0969da; }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        font-weight: 600;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #2da44e;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>ai-todo Dev Preview</h1>
      <p>本地 FastAPI 服务正在运行。当前阶段支持创建提醒、完成提醒和查询今日聚合数据。</p>
      <div class="status"><span class="dot"></span>API ready</div>

      <section>
        <h2>可预览接口</h2>
        <p><a href="/v1/health">/v1/health</a>：服务健康检查</p>
        <p><a href="/v1/today">/v1/today</a>：今日提醒与日程聚合</p>
      </section>

      <section>
        <h2>Personal Access Token</h2>
        <p>Agent / CLI 使用 PAT，写入 <code>~/.ai-todo/settings.json</code>（见小程序创建令牌后复制的 JSON）。</p>
        <p>安装 CLI：<code>npm install -g @ai-todo/cli</code></p>
      </section>

      <section>
        <h2>CLI 验证</h2>
        <p><code>ai-todo whoami</code></p>
        <p><code>ai-todo today --json</code></p>
      </section>
    </main>
  </body>
</html>"""
