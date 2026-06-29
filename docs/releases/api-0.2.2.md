# ai-todo API 0.2.2 发布说明

生产 API 正式域名切换为 **xingxiaolin.cn**（示例文案与根页同步）。

## 组件版本

| 组件       | 版本                                             |
| ---------- | ------------------------------------------------ |
| API        | `0.2.2`                                          |
| CLI        | `0.4.0`（用户自行更新 settings `url`）           |
| 微信小程序 | `0.4.0`（`PRODUCTION_API_URL` 已改；需重新上传） |

建议 Git `release_tag`：`v0.4.3`

## 变更摘要

- 文档、CLI 示例、API 根页、`cli_guidance.py` 默认 URL → `https://xingxiaolin.cn`
- 小程序 `lib/config.ts` 生产基址 → `xingxiaolin.cn`
- `wodi.games` 不在文档中作为正式域；网关可过渡保留供旧版小程序

## 运维

- `CD_PUBLIC_API_URL` → `https://xingxiaolin.cn`（发布前自行更新 Secret）
- 微信公众平台 request 合法域名添加 `xingxiaolin.cn`

## 验证

```bash
curl -sS https://xingxiaolin.cn/v1/health | jq '.data.apiVersion'
```
