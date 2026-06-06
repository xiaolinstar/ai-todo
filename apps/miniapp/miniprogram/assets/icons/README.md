Official ai-todo miniapp icon sources (SVG only in this package).

- `ai-todo-avatar-light.svg` / `ai-todo-avatar-dark.svg`: 1024×1024 vector masters for future in-app branding.

**WeChat upload limit:** each image/audio in `miniprogram/` must be ≤ 200KB. Do not add 1024 PNG exports here.

Raster masters (PNG) for API / favicon / store assets live under:

- `apps/api/src/ai_todo_api/static/icons/`

When the miniapp needs a bitmap icon, add a compressed variant (e.g. ≤ 144×144, ≤ 40KB) and reference it from WXML/JSON.
