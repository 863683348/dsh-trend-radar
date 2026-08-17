# dsh-trend-radar — 生态行情面板

**别人是目录，你是仪表盘。** 每小时快照 `dsh-plugin` topic 与 awesome-dsh-plugin 收录列表（本地 JSONL 历史），从时间维度分析：周报、新插件雷达、star 增速榜、类别热度、收录覆盖率 —— 并带一个 experimental 的 **Web 面板**（增长曲线、类别热度、Top 榜单）直接叠在会话输入框上方。

## 工具

- `trend_snapshot`：立即采集快照（GitHub topic 搜索 + awesome 收录树），追加历史；窗口期内自动跳过。
- `trend_report`：周报分析——新增插件、star 增速榜、类别热度、awesome 覆盖率；支持窗口与关键词过滤。
- `trend_watch`：关键词雷达——订阅、退订、列表、检查；新品命中或 star 突增即报。

## 安装

```bash
dsh plugin --profile <profile名> add dsh-trend-radar
```

## Web 面板（experimental）

装在有 Web UI 的 profile 上时，插件把最近一次 `trend_report` / `trend_snapshot` 的仪表盘数据（增长曲线、类别热度、新增插件榜、star 增速榜）通过 session projection 推给浏览器，渲染成输入框上方的只读面板。让 Agent 跑一次 `trend_snapshot` 或 `trend_report` 面板即刷新；每次新 turn 自动清空，避免展示过期数据。

## 数据流

GitHub search + awesome tree → `collectSnapshot` → `.dsh/trends/snapshots-*.jsonl` → `computeReport`/`deltaBetween` → 周报/雷达。

## 设计

- `lib/trends.js`（分析）、`lib/storage.js`（存储）、`lib/github.js`（采集）全零依赖可单测。
- 只读公开 API，无 secrets。
- **Web 面板**：`lib/client.js` 走 dsh-plugin-focus 同款 experimental client 模式（`dsh.client` manifest + session projection），待运行实例验证。

## License

MIT

## 常见问题

- **多久采集一次？** `trend_snapshot` 在 `staleHours`（默认 1 小时）窗口内自动跳过；无后台定时器，工具调用且数据过期时才采集。
- **限流？** 匿名 GitHub 搜索 10 次/分、60 次/时——每小时一次快照足够。配 `githubTokenEnv` 后 5000 次/时。
- **数据在哪？** `dataDir`（默认 `.dsh/trends`）：追加式 `snapshots-*.jsonl` + `watch.json`；删文件即重置历史。
- **Web 面板？** 已内置（experimental）：`dsh.client` manifest + `trendBoard` session projection，面板渲染在输入框上方，`trend_report`/`trend_snapshot` 后自动刷新。
