/**
 * dsh-trend-radar — runnable demo: collect a real snapshot and print the
 * weekly trend report. Run: node scripts/demo.mjs   (set GH_T for a token)
 */
import { collectSnapshot } from "../lib/github.js";
import { appendSnapshot, readSnapshots } from "../lib/storage.js";
import { computeReport, renderReport } from "../lib/trends.js";
import { mkdirSync } from "node:fs";

const dir = ".dsh/trends-demo";
mkdirSync(dir, { recursive: true });
const token = process.env.GH_T || "";
console.log("collecting snapshot from GitHub (topic:dsh-plugin)…");
const snap = await collectSnapshot(token);
appendSnapshot(dir, snap);
const history = readSnapshots(dir);
const report = computeReport(history, { periodDays: 7 });
console.log(renderReport(report));
console.log("\n(history stored under " + dir + "/)");
