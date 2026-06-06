"""User-facing CLI onboarding copy (keep in sync with miniapp + npm package)."""

CLI_NPM_PACKAGE = "@xiaolinstar/ai-todo-cli"
CLI_NPM_INSTALL = f"npm install -g {CLI_NPM_PACKAGE}"
CLI_BIN = "ai-todo"
CLI_SETTINGS_PATH = "~/.ai-todo/settings.json"
CLI_SETTINGS_EXAMPLE = (
    '{\n  "url": "https://xingxiaolin.cn",\n  "token": "aitodo_xxx"\n}'
)

SESSION_TOKEN_CLI_HINT = (
    "CLI requires a Personal Access Token. "
    "Create one in the WeChat miniapp (Mine → CLI / Agent tokens), "
    f"write {CLI_SETTINGS_PATH}, then run {CLI_BIN} whoami."
)
