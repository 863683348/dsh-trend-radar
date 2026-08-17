# dsh-trend-radar — 生态行情面板

**别人是目录，你是仪表盘。** 每小时快照 `dsh-plugin` topic 与 awesome-dsh-plugin 收录列表（本地 JSONL 历史），从时间维度分析：周报、新插件雷达、star 增速榜、类别热度、收录覆盖率。

## 工具

- `trend_snapshot`：立即采集快照（GitHub topic 搜索 + awesome 收录树），追加历史；窗口期内自动跳过。
- `trend_report`：周报分析——新增插件、star 增速榜、类别热度、awesome 覆盖率；支持窗口与关键词过滤。
- `trend_watch`：关键词雷达——订阅、退订、列表、检查；新品命中或 star 突增即报。

## 安装

```bash
dsh plugin --profile <profile名> add dsh-trend-radar
```

## 数据流

GitHub search + awesome tree → `collectSnapshot` → `.dsh/trends/snapshots-*.jsonl` → `computeReport`/`deltaBetween` → 周报/雷达。

## 设计

- `lib/trends.js`（分析）、`lib/storage.js`（存储）、`lib/github.js`（采集）全零依赖可单测。
- 只读公开 API，无 secrets。
- Roadmap：Web UI 仪表盘（experimental）。

## License

MIT

## 常见问题

- **多久采集一次？** `trend_snapshot` 在 `staleHours`（默认 1 小时）窗口内自动跳过；无后台定时器，工具调用且数据过期时才采集。
- **限流？** 匿名 GitHub 搜索 10 次/分、60 次/时——每小时一次快照足够。配 `githubTokenEnv` 后 5000 次/时。
- **数据在哪？** `dataDir`（默认 `.dsh/trends`）：追加式 `snapshots-*.jsonl` + `watch.json`；删文件即重置历史。
- **Web UI 仪表盘？** Roadmap 中——走与 dsh-plugin-focus 相同的 experimental client 面板路径。

