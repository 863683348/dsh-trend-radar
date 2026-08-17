/**
 * dsh-trend-radar — pure trend analysis over ecosystem snapshots.
 * Zero DSH/Cordis imports; unit-testable with fixture snapshots.
 *
 * A snapshot is `{ ts, repos: Repo[], awesome: string[] }` where Repo =
 * `{ name, stars, created, pushed, desc, topics }` and `awesome` lists the
 * repo names listed in the awesome-dsh-plugin directory.
 * @module dsh-trend-radar/trends
 */

/** Diff two consecutive snapshots. */
export function deltaBetween(prev, cur) {
  const prevStars = new Map((prev.repos ?? []).map((r) => [r.name, r.stars ?? 0]));
  const curRepos = new Map((cur.repos ?? []).map((r) => [r.name, r]));
  const added = (cur.repos ?? []).filter((r) => !prevStars.has(r.name));
  const removed = (prev.repos ?? []).filter((r) => !curRepos.has(r.name));
  const starDeltas = (cur.repos ?? [])
    .filter((r) => prevStars.has(r.name))
    .map((r) => ({ name: r.name, delta: (r.stars ?? 0) - (prevStars.get(r.name) ?? 0), stars: r.stars ?? 0 }))
    .filter((d) => d.delta !== 0)
    .sort((a, b) => b.delta - a.delta);
  return { added, removed, starDeltas };
}

/** Unix-ms cutoff `days` ago. */
export function cutoffMs(days, now = Date.now()) {
  return now - days * 86400_000;
}

/** Repo categories derived from awesome category by name (fallback). */
export function categoryOf(repo, categoryByName = {}) {
  if (categoryByName[repo.name]) return categoryByName[repo.name];
  return "unlisted";
}

/**
 * Build a human- and machine-readable trend report from a snapshot series.
 * @param snapshots - chronological snapshots (oldest first).
 * @param opts - `periodDays` (default 7), `categoryByName` map, `maxGainers`, `maxNew`.
 * @returns structured report.
 */
export function computeReport(snapshots, opts = {}) {
  const periodDays = opts.periodDays ?? 7;
  const now = opts.now ?? Date.now();
  const maxGainers = opts.maxGainers ?? 10;
  const maxNew = opts.maxNew ?? 10;
  const categoryByName = opts.categoryByName ?? {};
  if (snapshots.length === 0) {
    return { snapshots: 0, periodDays, newPlugins: [], starGainers: [], categoryHeat: [], awesomeCoverage: 0, total: 0 };
  }
  const latest = snapshots[snapshots.length - 1];
  const windowStart = cutoffMs(periodDays, now);
  const inWindow = snapshots.filter((s) => s.ts >= windowStart);
  const base = inWindow.length > 1 ? inWindow[0] : snapshots[0];
  const delta = deltaBetween(base, latest);

  const newPlugins = delta.added
    .filter((r) => (r.created ?? 0) >= windowStart || (r.created === undefined))
    .slice(0, maxNew)
    .map((r) => ({
      name: r.name,
      stars: r.stars ?? 0,
      created: r.created ?? null,
      desc: (r.desc ?? "").slice(0, 140),
      category: categoryOf(r, categoryByName),
    }));

  const starGainers = delta.starDeltas.slice(0, maxGainers).map((d) => ({
    name: d.name,
    delta: d.delta,
    stars: d.stars,
  }));

  const catCount = new Map();
  for (const r of delta.added) {
    const c = categoryOf(r, categoryByName);
    catCount.set(c, (catCount.get(c) ?? 0) + 1);
  }
  const categoryHeat = [...catCount.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const total = (latest.repos ?? []).length;
  const awesomeCoverage = total === 0 ? 0 : (latest.awesome ?? []).filter((n) => (latest.repos ?? []).some((r) => r.name === n)).length / total;
  return {
    snapshots: snapshots.length,
    periodDays,
    windowStart,
    latestTs: latest.ts,
    total,
    awesomeCoverage,
    newPlugins,
    starGainers,
    categoryHeat,
  };
}

/** Normalize a watch keyword: lowercase, trimmed. */
export function normalizeKeyword(k) {
  return String(k).toLowerCase().trim();
}

/**
 * Match repos against watch keywords (substring on name/desc/topics).
 * @param repos - candidate repos (usually the newest-added).
 * @param keywords - watch keywords.
 * @returns matched repos with the matched keyword.
 */
export function filterByKeywords(repos, keywords) {
  const keys = (keywords ?? []).map(normalizeKeyword).filter(Boolean);
  const out = [];
  for (const repo of repos) {
    const corpus = [repo.name, repo.desc ?? "", ...(repo.topics ?? [])].join(" ").toLowerCase();
    for (const k of keys) {
      if (corpus.includes(k)) {
        out.push({ name: repo.name, keyword: k, stars: repo.stars ?? 0, created: repo.created ?? null, desc: (repo.desc ?? "").slice(0, 140) });
        break;
      }
    }
  }
  return out;
}

/** Render a compact text dashboard from a report (what the model sees). */
export function renderReport(report) {
  const lines = [];
  lines.push("Ecosystem trend report (last " + report.periodDays + "d, " + report.snapshots + " snapshots, " + report.total + " repos)");
  lines.push("awesome-dsh-plugin coverage: " + Math.round(report.awesomeCoverage * 100) + "%");
  lines.push("");
  lines.push("## New plugins");
  if (report.newPlugins.length === 0) lines.push("(none in window)");
  for (const n of report.newPlugins) lines.push("- " + n.name + " [" + n.category + "] " + n.stars + "★ " + (n.desc || ""));
  lines.push("");
  lines.push("## Star gainers");
  if (report.starGainers.length === 0) lines.push("(no movement)");
  for (const g of report.starGainers) lines.push("- " + g.name + " +" + g.delta + "★ (now " + g.stars + ")");
  lines.push("");
  lines.push("## Category heat (new additions)");
  if (report.categoryHeat.length === 0) lines.push("(none)");
  for (const c of report.categoryHeat) lines.push("- " + c.category + ": " + c.count);
  return lines.join("\n");
}