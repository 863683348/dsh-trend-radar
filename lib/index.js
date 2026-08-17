/**
 * dsh-trend-radar — ecosystem trend dashboard ("行情面板"): hourly
 * snapshots of the dsh-plugin topic analyzed into weekly reports, new-plugin
 * radar, star-gain rankings, and category heat.
 *
 * Tools: `trend_snapshot` (collect now), `trend_report` (analyze), `trend_watch`
 * (keyword subscriptions for new plugins / star surges).
 *
 * Web panel: after each `trend_report` / `trend_snapshot` run, the latest
 * dashboard payload (growth curve, category heat, top lists) is emitted as a
 * `trend/update` session event and exposed to the browser client through the
 * `trendBoard` session projection (see ./client.js, experimental).
 * @module dsh-trend-radar
 */
import z from "@deepseek-ai/schemastery";
import { z as zod } from "zod";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { collectSnapshot } from "./github.js";
import { appendSnapshot, readSnapshots, readWatch, writeWatch } from "./storage.js";
import { buildDashboard, computeReport, cutoffMs, deltaBetween, filterByKeywords, normalizeKeyword, renderReport } from "./trends.js";

/** Cordis plugin name. */
const name = "trend-radar";

/** Services this plugin must resolve before it applies. */
const inject = ["tools", "systemPrompt", "fs"];

/** Composition-row configuration. */
const Config = z.object({
  /** Data directory (snapshots + watch list). Resolved against the fs cwd. */
  dataDir: z.string().default(".dsh/trends"),
  /** Auto-collect when the newest snapshot is older than this (hours). */
  staleHours: z.number().default(1),
  /** Star delta threshold for a "surge" in the radar. */
  surgeStars: z.number().default(20),
  /** Optional GitHub token env var name (anonymous API is rate-limited). */
  githubTokenEnv: z.string().default(""),
  /** Prompt section order. */
  sectionOrder: z.number().default(5),
});

const RADAR_SECTION_TEXT = "The `trend_*` tools are an ecosystem dashboard for dsh plugins: `trend_snapshot` collects a fresh snapshot of the dsh-plugin topic and the awesome list, `trend_report` turns the snapshot history into a weekly trend report (new plugins, star gainers, category heat, awesome coverage), and `trend_watch` subscribes to keywords for new-plugin/surge alerts. Use them when the user asks what is trending in the dsh ecosystem, what is new this week, or wants to watch a plugin area.";

/**
 * Register the three trend tools and the guidance section.
 * @param ctx - registrant context carrying `tools`, `systemPrompt`, `fs`.
 * @param config - validated plugin configuration.
 */
function apply(ctx, config) {
  const { dataDir, staleHours, surgeStars, githubTokenEnv, sectionOrder } = config;
  const token = githubTokenEnv ? process.env[githubTokenEnv] ?? "" : "";

  /** Resolve the absolute data directory once. */
  const dirFor = async (exec) => {
    const target = await ctx.fs.resolve(dataDir, exec?.signal !== undefined ? { signal: exec.signal } : {});
    return ctx.fs.processPath(target);
  };

  /** Read the snapshot history from disk (absolute dir). */
  const loadHistory = async (exec) => readSnapshots(await dirFor(exec));

  /**
   * Emit the latest dashboard payload to the calling session so the web panel
   * (trendBoard projection) refreshes. No-op when there is no session.
   */
  const emitDashboard = async (exec, days) => {
    if (!exec.agent?.session) return;
    const history = await loadHistory(exec);
    if (history.length === 0) return;
    const report = computeReport(history, { periodDays: days });
    exec.agent.session.append("trend/update", buildDashboard(history, report));
  };

  ctx.tools.register(defineTool({
    name: "trend_snapshot",
    description: "Collect a fresh ecosystem snapshot of the dsh-plugin topic (GitHub search, top 100 repos) plus the awesome-dsh-plugin listing, append it to the local trend history, and report what changed since the previous snapshot. Run when the user asks for current ecosystem state or when trend data may be stale.",
    parameters: {
      force: { type: "boolean", description: "Collect even when a fresh snapshot already exists (default false — auto-skip within the stale window)." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        required: true,
        properties: {
          ts: { type: "integer", required: true },
          total: { type: "integer", required: true },
          awesome: { type: "integer", required: true },
          added: { type: "array", required: true, items: { type: "string" } },
          removed: { type: "array", required: true, items: { type: "string" } },
          text: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.text }],
    },
    execute: async (args, exec) => {
      const dir = await dirFor(exec);
      const history = readSnapshots(dir);
      const latest = history[history.length - 1];
      const fresh = !args.force && latest !== undefined && Date.now() - latest.ts < staleHours * 3600_000;
      let added = [];
      let removed = [];
      let total = 0;
      let awesomeCount = 0;
      let ts = latest?.ts ?? 0;
      let text;
      if (fresh) {
        total = (latest.repos ?? []).length;
        awesomeCount = (latest.awesome ?? []).length;
        text = "Snapshot is fresh (" + new Date(latest.ts).toISOString() + ", " + total + " repos) — use force:true to re-collect.";
      } else {
        const snap = await collectSnapshot(token);
        appendSnapshot(dir, snap);
        history.push(snap);
        const delta = history.length >= 2 ? deltaBetween(history[history.length - 2], snap) : { added: snap.repos, removed: [] };
        added = delta.added.map((r) => r.name);
        removed = delta.removed.map((r) => r.name);
        total = snap.repos.length;
        awesomeCount = snap.awesome.length;
        ts = snap.ts;
        text = "Collected snapshot " + new Date(snap.ts).toISOString() + ": " + total + " repos (" + added.length + " new), " + awesomeCount + " listed on awesome-dsh-plugin.";
      }
      await emitDashboard(exec, 7);
      return { ts, total, awesome: awesomeCount, added, removed, text };
    },
    presentCall: (args) => ({ card: "generic", title: "Collect ecosystem snapshot", kind: "other", rawInput: args }),
  }));

  ctx.tools.register(defineTool({
    name: "trend_report",
    description: "Analyze the local snapshot history into a trend report: new plugins in the window, star-gain ranking, category heat (new additions by awesome category), and awesome-list coverage. Generates the weekly ecosystem dashboard.",
    parameters: {
      days: { type: "integer", description: "Analysis window in days (default 7)." },
      keywords: { type: "array", items: { type: "string" }, description: "Optional keywords to filter the new-plugins list." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        required: true,
        properties: {
          snapshots: { type: "integer", required: true },
          periodDays: { type: "integer", required: true },
          total: { type: "integer", required: true },
          awesomeCoverage: { type: "number", required: true },
          newPlugins: { type: "array", required: true, items: { type: "object", additionalProperties: false, required: true, properties: { name: { type: "string", required: true }, stars: { type: "integer", required: true }, created: { type: ["integer", "null"], required: true }, desc: { type: "string", required: true }, category: { type: "string", required: true } } } },
          starGainers: { type: "array", required: true, items: { type: "object", additionalProperties: false, required: true, properties: { name: { type: "string", required: true }, delta: { type: "integer", required: true }, stars: { type: "integer", required: true } } } },
          categoryHeat: { type: "array", required: true, items: { type: "object", additionalProperties: false, required: true, properties: { category: { type: "string", required: true }, count: { type: "integer", required: true } } } },
          text: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.text }],
    },
    execute: async (_args, exec) => {
      const dir = await dirFor(exec);
      const history = readSnapshots(dir);
      const days = Number.isInteger(_args.days) && _args.days > 0 ? _args.days : 7;
      const report = computeReport(history, { periodDays: days });
      const keywords = Array.isArray(_args.keywords) ? _args.keywords.filter((k) => typeof k === "string") : [];
      let newPlugins = report.newPlugins;
      if (keywords.length > 0) {
        const matches = filterByKeywords(report.newPlugins.map((p) => ({ name: p.name, desc: p.desc, topics: [p.category] })), keywords);
        newPlugins = report.newPlugins.filter((p) => matches.some((m) => m.name === p.name));
      }
      const withFiltered = { ...report, newPlugins };
      await emitDashboard(exec, days);
      return {
        snapshots: report.snapshots,
        periodDays: report.periodDays,
        total: report.total,
        awesomeCoverage: report.awesomeCoverage,
        newPlugins,
        starGainers: report.starGainers,
        categoryHeat: report.categoryHeat,
        text: renderReport(withFiltered),
      };
    },
    presentCall: (args) => ({ card: "generic", title: "Ecosystem trend report", kind: "other", rawInput: args }),
  }));

  ctx.tools.register(defineTool({
    name: "trend_watch",
    description: "Manage keyword subscriptions and check them against the newest snapshot delta: new plugins matching a keyword, and star surges (>= configurable threshold). Use to alert on new plugins or rising stars in a specific area (e.g. wechat, notification, security).",
    parameters: {
      action: { type: "string", required: true, enum: ["list", "add", "remove", "check"], description: "list subscriptions, add a keyword, remove a keyword, or check the latest delta against all subscriptions." },
      keyword: { type: "string", description: "Keyword for add/remove (lowercased, trimmed)." },
    },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        required: true,
        properties: {
          keywords: { type: "array", required: true, items: { type: "string" } },
          matches: { type: "array", required: true, items: { type: "object", additionalProperties: false, required: true, properties: { name: { type: "string", required: true }, keyword: { type: "string", required: true }, stars: { type: "integer", required: true }, created: { type: ["integer", "null"], required: true }, desc: { type: "string", required: true } } } },
          text: { type: "string", required: true },
        },
      },
      render: (_args, value) => [{ type: "text", text: value.text }],
    },
    execute: async (args, exec) => {
      const dir = await dirFor(exec);
      let keywords = readWatch(dir);
      const action = args.action;
      if (action === "add" || action === "remove") {
        const k = normalizeKeyword(args.keyword ?? "");
        if (k.length === 0) throw new Error("trend_watch: keyword required for " + action);
        if (action === "add" && !keywords.includes(k)) keywords.push(k);
        if (action === "remove") keywords = keywords.filter((x) => x !== k);
        writeWatch(dir, keywords);
        return { keywords, matches: [], text: "Watch keywords (" + action + " " + (args.keyword ?? "") + "): " + keywords.join(", ") };
      }
      const history = readSnapshots(dir);
      let matches = [];
      let text;
      if (action === "list") {
        text = "Watch keywords: " + (keywords.length === 0 ? "(none)" : keywords.join(", "));
      } else {
        if (history.length < 2) {
          text = "Need at least 2 snapshots to check — run trend_snapshot first.";
        } else {
          const delta = deltaBetween(history[history.length - 2], history[history.length - 1]);
          const newMatches = filterByKeywords(delta.added, keywords);
          const surgeMatches = filterByKeywords(delta.starDeltas.filter((d) => d.delta >= surgeStars).map((d) => ({ name: d.name, desc: "+" + d.delta + " stars", topics: [] })), keywords);
          matches = [...newMatches, ...surgeMatches];
          text = "Checked " + keywords.length + " keyword" + (keywords.length === 1 ? "" : "s") + ": " + matches.length + " match" + (matches.length === 1 ? "" : "es") + " in the latest delta.";
        }
      }
      return { keywords, matches, text };
    },
    presentCall: (args) => ({ card: "generic", title: "Trend watch: " + (args.action ?? ""), kind: "other", rawInput: args }),
  }));

  // Session projection: the latest dashboard payload, for the web panel
  // (useProjection('trendBoard')). Emitted by trend_report / trend_snapshot;
  // reset at each turn start so stale snapshots never linger.
  ctx.inject(["sessionProjections"], (projectionCtx) => {
    projectionCtx.sessionProjections.register({
      key: "trendBoard",
      schema: zod.union([
        zod.object({
          ts: zod.number(),
          snapshots: zod.number(),
          total: zod.number(),
          awesomeCoverage: zod.number(),
          series: zod.array(zod.object({ ts: zod.number(), count: zod.number() })),
          newPlugins: zod.array(zod.object({ name: zod.string(), stars: zod.number(), desc: zod.string(), category: zod.string() })),
          starGainers: zod.array(zod.object({ name: zod.string(), delta: zod.number(), stars: zod.number() })),
          categoryHeat: zod.array(zod.object({ category: zod.string(), count: zod.number() })),
        }),
        zod.null(),
      ]),
      init: () => null,
      apply: (state, event) => {
        if (event.type === "trend/update") return event.data;
        if (event.type === "turn/start") return null;
        return state;
      },
      view: (state) => state,
      stateVersion: 1,
    });
  });

  ctx.effect(() => ctx.systemPrompt.section({
    name: "trend-radar:instructions",
    order: sectionOrder,
    text: RADAR_SECTION_TEXT,
  }), "trend-radar.section()");
}

export { Config, RADAR_SECTION_TEXT, apply, inject, name };
