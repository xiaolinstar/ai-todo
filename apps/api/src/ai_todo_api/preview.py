from ai_todo_api.cli_guidance import (
    CLI_BIN,
    CLI_NPM_INSTALL,
    CLI_SETTINGS_EXAMPLE,
    CLI_SETTINGS_PATH,
)
from ai_todo_api.config import settings


ICON_PATH = "/static/icons/ai-todo.svg"
GONGAN_ICON_PATH = "/static/icons/gonganlianwang.png"


def _beian_footer() -> str:
    links: list[str] = []
    if not settings.icp_beian_text:
        return ""
    links.append(
        '<a href="https://beian.miit.gov.cn/" target="_blank" '
        f'rel="noopener noreferrer">{settings.icp_beian_text}</a>'
    )
    if settings.public_security_beian_text:
        links.append(
            '<a class="footer__gongan" href="https://beian.mps.gov.cn/" target="_blank" '
            f'rel="noopener noreferrer"><img src="{GONGAN_ICON_PATH}" alt="" />'
            f"{settings.public_security_beian_text}</a>"
        )
    return '<div class="footer__beian">' + '<span class="footer__divider">|</span>'.join(links) + "</div>"


def preview_page() -> str:
    beian_footer = _beian_footer()
    return f"""<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ai-todo API</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="shortcut icon" href="/favicon.ico" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="{ICON_PATH}" />
    <style>
      :root {{
        color-scheme: light;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f6f8fc;
        color: #17202c;
      }}
      * {{ box-sizing: border-box; }}
      html {{ min-width: 320px; }}
      body {{
        margin: 0;
        min-height: 100vh;
        background: #f6f8fc;
      }}
      a {{ color: #1456d9; text-decoration: none; }}
      a:hover {{ text-decoration: underline; }}
      .page {{
        min-height: 100vh;
        background:
          linear-gradient(135deg, rgba(20, 86, 217, 0.12) 0%, rgba(255, 255, 255, 0) 34%),
          linear-gradient(180deg, #ffffff 0%, #f6f8fc 58%, #eef3f9 100%);
      }}
      .shell {{
        width: min(1080px, calc(100% - 48px));
        margin: 0 auto;
        padding: 26px 0 30px;
      }}
      h1, h2, h3, p {{ margin-top: 0; }}
      h1 {{
        max-width: 620px;
        margin-bottom: 14px;
        font-size: clamp(34px, 5.2vw, 58px);
        line-height: 1.04;
        letter-spacing: 0;
      }}
      h2 {{
        margin-bottom: 8px;
        font-size: 21px;
        line-height: 1.25;
        letter-spacing: 0;
      }}
      h3 {{ margin-bottom: 6px; font-size: 16px; letter-spacing: 0; }}
      p {{ color: #52606d; font-size: 14px; line-height: 1.62; }}
      code, pre {{
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
      }}
      code {{
        padding: 2px 7px;
        border-radius: 6px;
        background: #eef3fa;
        color: #243b53;
      }}
      pre {{
        margin: 14px 0 0;
        padding: 16px;
        border: 1px solid rgba(18, 35, 58, 0.1);
        border-radius: 14px;
        background: #101827;
        color: #e6edf7;
        overflow-x: auto;
      }}
      pre code {{
        padding: 0;
        background: transparent;
        color: inherit;
      }}
      .topbar {{
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        min-height: 44px;
        margin-bottom: 42px;
      }}
      .brand {{
        display: inline-flex;
        align-items: center;
        gap: 12px;
        color: #17202c;
        font-size: 16px;
        font-weight: 800;
      }}
      .brand img {{
        width: 38px;
        height: 38px;
        display: block;
        border-radius: 12px;
      }}
      .nav {{
        display: flex;
        align-items: center;
        gap: 8px;
      }}
      .nav a {{
        min-height: 36px;
        padding: 8px 12px;
        border-radius: 999px;
        color: #52606d;
        font-size: 14px;
        font-weight: 650;
      }}
      .nav a:hover {{
        background: rgba(20, 86, 217, 0.08);
        color: #1456d9;
        text-decoration: none;
      }}
      .hero {{
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(300px, 0.92fr);
        gap: 28px;
        align-items: center;
        padding-bottom: 24px;
      }}
      .eyebrow {{
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        margin-bottom: 14px;
        padding: 5px 11px;
        border: 1px solid rgba(20, 86, 217, 0.16);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.76);
        color: #1456d9;
        font-size: 13px;
        font-weight: 800;
      }}
      .lead {{
        max-width: 680px;
        margin-bottom: 20px;
        color: #3e4c59;
        font-size: 16px;
      }}
      .status {{
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 7px 12px;
        border: 1px solid #c8e6d1;
        border-radius: 999px;
        background: #f0fff4;
        color: #17663a;
        font-size: 13px;
        font-weight: 650;
      }}
      .dot {{
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #2f9e44;
        box-shadow: 0 0 0 4px rgba(47, 158, 68, 0.14);
      }}
      .hero-actions {{
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }}
      .button {{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 38px;
        padding: 9px 14px;
        border: 1px solid rgba(20, 86, 217, 0.16);
        border-radius: 999px;
        background: #ffffff;
        color: #17202c;
        font-size: 14px;
        font-weight: 720;
        box-shadow: 0 8px 24px rgba(16, 42, 67, 0.07);
      }}
      .button--primary {{
        border-color: #1456d9;
        background: #1456d9;
        color: #ffffff;
      }}
      .button:hover {{ text-decoration: none; transform: translateY(-1px); }}
      .surface, .card {{
        border: 1px solid rgba(18, 35, 58, 0.1);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.82);
        box-shadow: 0 18px 50px rgba(16, 42, 67, 0.08);
        backdrop-filter: blur(18px);
      }}
      .surface {{
        position: relative;
        overflow: hidden;
        padding: 20px;
      }}
      .surface::before {{
        content: "";
        position: absolute;
        inset: 0 0 auto 0;
        height: 5px;
        background: linear-gradient(90deg, #1456d9, #16a34a, #f59e0b);
      }}
      .terminal {{
        margin-top: 14px;
        border-radius: 16px;
        background: #0f172a;
        color: #dbeafe;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
      }}
      .terminal__bar {{
        display: flex;
        gap: 6px;
        padding: 11px 13px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }}
      .terminal__bar span {{
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #64748b;
      }}
      .terminal pre {{
        margin: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
      }}
      .stats {{
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 14px;
      }}
      .stat {{
        padding: 12px;
        border-radius: 14px;
        background: #f7faff;
      }}
      .stat strong {{ display: block; color: #17202c; font-size: 15px; }}
      .stat span {{ color: #627d98; font-size: 12px; }}
      .grid {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 14px;
        margin-top: 14px;
      }}
      .card {{
        padding: 18px;
      }}
      .card p:last-child {{ margin-bottom: 0; }}
      .card__head {{
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }}
      .mark {{
        width: 36px;
        height: 36px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        border-radius: 12px;
        background: #eef4ff;
        color: #1456d9;
        font-weight: 800;
      }}
      .section {{ margin-top: 18px; }}
      .section-title {{
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 10px;
      }}
      .section-title p {{
        max-width: 460px;
        margin-bottom: 0;
        font-size: 13px;
      }}
      .steps {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 12px;
      }}
      .step {{
        padding: 16px;
        border: 1px solid rgba(18, 35, 58, 0.1);
        border-radius: 18px;
        background: #ffffff;
      }}
      .step__no {{
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;
        border-radius: 999px;
        background: #17202c;
        color: #ffffff;
        font-size: 13px;
        font-weight: 800;
      }}
      .footer {{
        border-top: 1px solid rgba(18, 35, 58, 0.08);
        background: rgba(255, 255, 255, 0.72);
      }}
      .footer__container {{
        width: min(1080px, calc(100% - 48px));
        margin: 0 auto;
        padding: 22px 0 30px;
        color: #829ab1;
        font-size: 13px;
        text-align: center;
      }}
      .footer p {{ margin-bottom: 8px; color: #829ab1; line-height: 1.6; }}
      .footer a {{ color: #627d98; }}
      .footer__gongan {{
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }}
      .footer__gongan img {{
        width: 14px;
        height: 14px;
        object-fit: contain;
      }}
      .footer__beian {{
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }}
      .footer__divider {{ color: #bcccdc; }}
      @media (max-width: 920px) {{
        .shell, .footer__container {{ width: min(100% - 32px, 720px); }}
        .topbar {{ margin-bottom: 30px; }}
        .hero {{ grid-template-columns: 1fr; gap: 24px; }}
      }}
      @media (max-width: 640px) {{
        .shell {{ padding-top: 18px; padding-bottom: 24px; }}
        .topbar {{
          align-items: flex-start;
          margin-bottom: 24px;
        }}
        .nav {{ display: none; }}
        h1 {{ font-size: 34px; line-height: 1.08; }}
        h2 {{ font-size: 19px; }}
        .lead {{ font-size: 15px; }}
        .hero-actions {{ flex-direction: column; }}
        .button {{ width: 100%; }}
        .grid {{ grid-template-columns: 1fr; gap: 12px; }}
        .surface, .card {{ border-radius: 18px; padding: 16px; }}
        .stats {{ grid-template-columns: 1fr; }}
        .section-title {{ display: block; }}
        .footer__container {{ width: min(100% - 32px, 720px); }}
        .footer__beian {{
          flex-direction: column;
          gap: 6px;
        }}
        .footer__divider {{ display: none; }}
      }}
    </style>
  </head>
  <body>
    <div class="page">
      <main class="shell">
        <header class="topbar">
          <a class="brand" href="/" aria-label="ai-todo API">
            <img src="{ICON_PATH}" alt="" />
            <span>AI日省待办</span>
          </a>
          <nav class="nav" aria-label="主要入口">
            <a href="/v1/health">健康检查</a>
            <a href="https://github.com/xiaolinstar/ai-todo">GitHub</a>
            <a href="https://www.npmjs.com/package/{CLI_NPM_INSTALL.split()[-1]}">npm CLI</a>
          </nav>
        </header>

        <section class="hero">
          <div>
            <p class="eyebrow">Miniapp · CLI · Agent Skill</p>
            <h1>AI日省待办 API</h1>
            <p class="lead">小程序创建令牌，CLI 和 Agent 安全接入。</p>
            <div class="status"><span class="dot"></span>API ready</div>
            <div class="hero-actions">
              <a class="button button--primary" href="/v1/health">查看服务状态</a>
              <a class="button" href="https://www.npmjs.com/package/{CLI_NPM_INSTALL.split()[-1]}">安装 npm CLI</a>
              <a class="button" href="https://github.com/xiaolinstar/ai-todo/tree/main/skills/ai-todo">查看 Skill</a>
            </div>
          </div>

          <aside class="surface" aria-label="快速接入">
            <h2>快速接入</h2>
            <p>从小程序到终端，三步完成接入。</p>
            <div class="terminal" aria-label="CLI 安装命令">
              <div class="terminal__bar"><span></span><span></span><span></span></div>
              <pre><code>{CLI_NPM_INSTALL}
{CLI_BIN} whoami
{CLI_BIN} today --json</code></pre>
            </div>
            <div class="stats">
              <div class="stat"><strong>微信小程序</strong><span>用户数据入口</span></div>
              <div class="stat"><strong>Bearer PAT</strong><span>CLI / Agent 鉴权</span></div>
              <div class="stat"><strong>{CLI_BIN}</strong><span>本地命令行</span></div>
              <div class="stat"><strong>Skill</strong><span>Agent 使用说明</span></div>
            </div>
          </aside>
        </section>

        <section class="section" aria-label="使用方式">
          <div class="section-title">
            <h2>使用方式</h2>
            <p>一个 API，连接用户、CLI 和 Agent。</p>
          </div>
          <div class="grid">
            <article class="card">
              <div class="card__head"><span class="mark">01</span><h3>面向用户</h3></div>
              <p>在小程序管理提醒、日程和联系人，并创建访问令牌。</p>
            </article>

            <article class="card">
              <div class="card__head"><span class="mark">02</span><h3>面向 Agent</h3></div>
              <p>使用 <code>skills/ai-todo/SKILL.md</code>，让 Agent 通过 CLI 调用待办能力。</p>
            </article>
          </div>
        </section>

        <section class="section" aria-label="配置步骤">
          <div class="section-title">
            <h2>三步接入</h2>
            <p>完整 PAT 仅显示一次，请及时保存。</p>
          </div>
          <div class="steps">
            <article class="step">
              <span class="step__no">1</span>
              <h3>进入小程序</h3>
              <p>微信搜索「AI日省待办」，在 CLI / Agent 接入中创建 PAT。</p>
            </article>
            <article class="step">
              <span class="step__no">2</span>
              <h3>安装 CLI</h3>
              <p>Mac / Linux 终端执行 <code>{CLI_NPM_INSTALL}</code>。</p>
            </article>
            <article class="step">
              <span class="step__no">3</span>
              <h3>粘贴并验证</h3>
              <p>粘贴 PAT 到 <code>{CLI_SETTINGS_PATH}</code>，再执行 <code>{CLI_BIN} whoami</code>。</p>
            </article>
          </div>
        </section>

        <section class="section card config-card" aria-label="配置示例">
          <div class="card__head"><span class="mark">JSON</span><h2>配置示例</h2></div>
          <pre><code>{CLI_SETTINGS_EXAMPLE}</code></pre>
        </section>
      </main>
    </div>
    <footer class="footer">
      <div class="footer__container">
        <p class="footer__copyright">©️ 2026 xiaolinstar. All rights reserved.</p>
        {beian_footer}
      </div>
    </footer>
  </body>
</html>"""
