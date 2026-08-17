import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeReport,
  cutoffMs,
  deltaBetween,
  filterByKeywords,
  normalizeKeyword,
  renderReport,
} from "../lib/trends.js";

const DAY = 86400_000;
const NOW = 10 * DAY;
const mk = (name, stars, extra = {}) => ({ name, stars, created: extra.created ?? NOW - DAY, pushed: 0, desc: extra.desc ?? "", topics: extra.topics ?? [] });

const snap0 = { ts: 0, repos: [mk("a/a", 5), mk("b/b", 3)], awesome: ["a/a"] };
const snap1 = { ts: DAY, repos: [mk("a/a", 7), mk("b/b", 3), mk("c/c", 1)], awesome: ["a/a", "c/c"] };
const snap2 = { ts: 2 * DAY, repos: [mk("a/a", 9), mk("b/b", 3), mk("c/c", 2), mk("d/d", 1)], awesome: ["a/a", "c/c", "d/d"] };

test("deltaBetween reports added, removed, and star deltas sorted", () => {
  const d = deltaBetween(snap1, snap2);
  assert.deepEqual(d.added.map((r) => r.name), ["d/d"]);
  assert.deepEqual(d.removed, []);
  assert.deepEqual(d.starDeltas.map((x) => [x.name, x.delta]), [["a/a", 2], ["c/c", 1]]);
});

test("computeReport: new plugins, gainers, category heat, coverage", () => {
  const report = computeReport([snap0, snap1, snap2], { periodDays: 7, now: NOW, categoryByName: { "c/c": "notify", "d/d": "tools" } });
  assert.equal(report.snapshots, 3);
  assert.equal(report.total, 4);
  assert.deepEqual(report.newPlugins.map((p) => p.name), ["c/c", "d/d"]);
  assert.equal(report.newPlugins[0].category, "notify");
  assert.equal(report.starGainers[0].name, "a/a");
  assert.deepEqual(report.categoryHeat.map((c) => [c.category, c.count]), [["notify", 1], ["tools", 1]]);
  assert.ok(report.awesomeCoverage > 0.5, "coverage > 50%");
});

test("computeReport handles empty history", () => {
  const report = computeReport([]);
  assert.equal(report.snapshots, 0);
  assert.deepEqual(report.newPlugins, []);
});

test("cutoffMs computes the window edge", () => {
  const now = 10 * DAY;
  assert.equal(cutoffMs(7, now), now - 7 * DAY);
});

test("filterByKeywords matches name/desc/topics case-insensitively", () => {
  const repos = [
    mk("x/dsh-wechat-bridge", 1, { desc: "WeChat bridge", topics: ["im"] }),
    mk("y/dsh-security", 2, { desc: "audit tool" }),
  ];
  const m = filterByKeywords(repos, ["WeChat"]);
  assert.equal(m.length, 1);
  assert.equal(m[0].name, "x/dsh-wechat-bridge");
  assert.equal(m[0].keyword, "wechat");
});

test("normalizeKeyword lowercases and trims", () => {
  assert.equal(normalizeKeyword("  WeChat  "), "wechat");
});

test("renderReport renders a dashboard text", () => {
  const report = computeReport([snap0, snap1, snap2], { periodDays: 7, now: NOW, categoryByName: { "c/c": "notify" } });
  const text = renderReport(report);
  assert.ok(text.includes("Ecosystem trend report"));
  assert.ok(text.includes("New plugins"));
  assert.ok(text.includes("Star gainers"));
});

test("storage: snapshot roundtrip and watch persistence", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { appendSnapshot, readSnapshots, readWatch, writeWatch } = await import("../lib/storage.js");
  const dir = mkdtempSync(join(tmpdir(), "trend-"));
  try {
    appendSnapshot(dir, { ts: 1, repos: [], awesome: [] });
    appendSnapshot(dir, { ts: 2, repos: [], awesome: [] });
    assert.equal(readSnapshots(dir).length, 2);
    writeWatch(dir, ["wechat", "notify"]);
    assert.deepEqual(readWatch(dir), ["wechat", "notify"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test("computeReport with a single snapshot (no history depth)", () => {
  const report = computeReport([snap2], { periodDays: 7, now: NOW });
  assert.equal(report.snapshots, 1);
  assert.ok(report.total > 0);
  assert.deepEqual(report.starGainers, []);
});

test("computeReport window excludes plugins created before the window", () => {
  const old = mk("old/plugin", 5, { created: NOW - 30 * DAY });
  const snap = { ts: NOW, repos: [old], awesome: [] };
  const report = computeReport([snap], { periodDays: 7, now: NOW });
  assert.equal(report.newPlugins.length, 0);
});

test("filterByKeywords with no keywords matches nothing", () => {
  assert.deepEqual(filterByKeywords([mk("a/b", 1)], []), []);
});

test("storage tolerates a missing directory", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { readSnapshots, readWatch } = await import("../lib/storage.js");
  const dir = mkdtempSync(join(tmpdir(), "trend-empty-"));
  try {
    assert.deepEqual(readSnapshots(dir), []);
    assert.deepEqual(readWatch(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
