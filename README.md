# dsh-trend-radar — 生态行情面板 (Ecosystem trend dashboard)

**别人是目录，你是仪表盘。** 每小时对 `dsh-plugin` topic 与 awesome-dsh-plugin 收录列表做一次快照（本地 JSONL 历史），然后从**时间维度**分析趋势：周报、新插件雷达、star 增速榜、类别热度、收录覆盖率 —— 并带一个 experimental 的 **Web 面板**（增长曲线、类别热度、Top 榜单）直接叠在会话输入框上方。

## 为什么需要它

- 现有市场/目录都是"当前时刻"的静态视图；**趋势是空白**——没有人在看"这周新增了什么、谁在涨、哪个类别在热"。
- 快照只占本地磁盘（每条约几十 KB JSONL），分析全部本地完成。

## 工具

| 工具 | 作用 |
| --- | --- |
| `trend_snapshot` | 立即采集一次快照（GitHub `topic:dsh-plugin` 搜索 + awesome 收录树），追加到本地历史；窗口期内自动跳过（`force: true` 强制） |
| `trend_report` | 分析历史 → 周报：新增插件、star 增速榜、类别热度、awesome 覆盖率；支持 `days` 窗口与 `keywords` 过滤 |
| `trend_watch` | 关键词订阅雷达：`add`/`remove`/`list`/`check`——新品命中或 star 突增（≥`surgeStars`）即报 |

## 安装

```bash
dsh plugin --profile <profile> add dsh-trend-radar
```

## 配置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `dataDir` | `.dsh/trends` | 快照与订阅的存储目录（相对宿主 fs cwd） |
| `staleHours` | `1` | 快照新鲜度窗口（小时） |
| `surgeStars` | `20` | 雷达的 star 突增阈值 |
| `githubTokenEnv` | `` | 可选：GitHub token 的环境变量名（匿名 API 限流 60 次/小时，够用；设 token 更稳） |
| `sectionOrder` | `5` | 提示词段落顺序 |

## Web 面板（experimental）

装在有 Web UI 的 profile 上时，插件把最近一次 `trend_report` / `trend_snapshot` 的仪表盘数据（增长曲线、类别热度、新增插件榜、star 增速榜）通过 session projection 推给浏览器，渲染成输入框上方的只读面板。让 Agent 跑一次 `trend_snapshot` 或 `trend_report` 面板即刷新；每次新 turn 自动清空，避免展示过期数据。

## 数据流

```text
GitHub search (topic:dsh-plugin, top 100)
  + awesome-dsh-plugin git tree (data/plugins/*.yml)
        ↓ collectSnapshot()
.data dsh/trends/snapshots-YYYY-MM-DD.jsonl   (append-only)
        ↓ computeReport() / deltaBetween()
trend_report (周报) · trend_watch (雷达) · trend_snapshot (增量)
```

## 设计

- **纯逻辑分离**：`lib/trends.js`（增量/周报/雷达过滤/渲染）、`lib/storage.js`（JSONL + watch.json）、`lib/github.js`（采集 + 解析分离）——全部零 DSH/Cordis 依赖，可单测。
- **安全**：只读公开 API，写本地数据目录；无 secrets、无注入。
- **Web 面板**：`lib/client.js` 走 dsh-plugin-focus 同款 experimental client 模式（`dsh.client` manifest + session projection），待运行实例验证。

## 测试

```bash
node test/trends.test.mjs
```

## License

MIT

## FAQ

- **How often should I snapshot?** The `trend_snapshot` tool auto-skips inside the `staleHours` window (default 1h). There is no background timer; collection happens when a tool runs and the history is stale.
- **Rate limits?** Anonymous GitHub search is 10 req/min / 60 req/h — plenty for hourly snapshots. Set `githubTokenEnv` (e.g. `GH_T`) to a token for 5000 req/h.
- **Where is the data?** `dataDir` (default `.dsh/trends`): append-only `snapshots-YYYY-MM-DD.jsonl` plus `watch.json`. Delete files to reset history.
- **The Web UI dashboard?** On the roadmap — same experimental client-panel path as dsh-plugin-focus.
