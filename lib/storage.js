/**
 * dsh-trend-radar — snapshot storage: append-only JSONL + watch keywords.
 * Pure node:fs logic, unit-testable against a temp directory.
 * @module dsh-trend-radar/storage
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Read all snapshots (oldest first), tolerating a missing/corrupt tail. */
export function readSnapshots(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  const out = [];
  for (const f of files) {
    for (const line of readFileSync(join(dir, f), "utf8").split(/\r?\n/)) {
      if (line.trim().length === 0) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        /* skip corrupt line */
      }
    }
  }
  return out;
}

/** Append one snapshot to today's jsonl file (created on demand). */
export function appendSnapshot(dir, snapshot) {
  mkdirSync(dir, { recursive: true });
  const date = new Date(snapshot.ts).toISOString().slice(0, 10);
  const file = join(dir, "snapshots-" + date + ".jsonl");
  writeFileSync(file, JSON.stringify(snapshot) + "\n", { flag: "a" });
  return file;
}

/** Read the watch keyword list ([] when absent). */
export function readWatch(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, "watch.json"), "utf8"));
  } catch {
    return [];
  }
}

/** Persist the watch keyword list. */
export function writeWatch(dir, keywords) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "watch.json"), JSON.stringify(keywords, null, 1) + "\n");
}
