/**
 * dsh-trend-radar — ecosystem data collection (GitHub API + awesome list).
 * Fetch logic only; parsing is separated so it can be unit-tested.
 * @module dsh-trend-radar/github
 */

const BASE = "https://api.github.com";

/** Headers for GitHub REST calls. */
export function ghHeaders(token) {
  const h = { "User-Agent": "dsh-trend-radar", Accept: "application/vnd.github+json" };
  if (token) h.Authorization = "Bearer " + token;
  return h;
}

/**
 * Parse a GitHub search response into repo snapshots.
 * @param data - the parsed `/search/repositories` body.
 * @returns repo list (`{ name, stars, created, pushed, desc, topics }`).
 */
export function parseSearchItems(data) {
  return (data.items ?? []).map((r) => ({
    name: r.full_name,
    stars: r.stargazers_count ?? 0,
    created: Date.parse(r.created_at ?? "") || 0,
    pushed: Date.parse(r.pushed_at ?? "") || 0,
    desc: r.description ?? "",
    topics: r.topics ?? [],
  }));
}

/** Fetch the newest 100 `topic:dsh-plugin` repos. */
export async function fetchTopicRepos(token) {
  const url = BASE + "/search/repositories?q=topic:dsh-plugin&sort=updated&order=desc&per_page=100";
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error("GitHub search failed: HTTP " + res.status);
  return parseSearchItems(await res.json());
}

/**
 * Fetch the repo names listed in the awesome-dsh-plugin directory (by
 * listing the git tree once — cheap and stable).
 */
export async function fetchAwesomeList(token) {
  const url = BASE + "/repos/awesome-dsh-plugin/awesome-dsh-plugin/git/trees/main?recursive=1";
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error("awesome tree failed: HTTP " + res.status);
  const data = await res.json();
  const names = [];
  for (const entry of data.tree ?? []) {
    const p = entry.path ?? "";
    if (p.startsWith("data/plugins/") && p.endsWith(".yml")) {
      names.push(p.slice("data/plugins/".length, -4).replace("__", "/"));
    }
  }
  return names;
}

/** One complete ecosystem snapshot. */
export async function collectSnapshot(token) {
  const [repos, awesome] = await Promise.all([
    fetchTopicRepos(token),
    fetchAwesomeList(token),
  ]);
  return { ts: Date.now(), repos, awesome };
}
