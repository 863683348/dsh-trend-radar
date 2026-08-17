# Changelog

## [0.2.1] — 2026-08-17

Runtime validation fix (found by booting a real web profile).

- Tool output schemas now place `required: true` on properties only — the dsh-tools value schema DSL rejects a top-level `required` and `type` arrays (`created` now uses `oneOf`). Verified live: `dsh web` boots the profile and serves `/plugins/dsh-trend-radar/client.js` (200) with the panel module and `trendBoard` projection.

## [0.2.0] — 2026-08-17

Experimental web panel.

- `trendBoard` session projection: after each `trend_report` / `trend_snapshot` run, the dashboard payload (growth curve, category heat, new-plugin and star-gainer lists) is emitted as a `trend/update` session event.
- `lib/client.js`: read-only dashboard panel rendered above the composer (conversation.input.dock) from the projection — SVG growth curve, category heat bars, top lists. Experimental (same loader-format path as dsh-plugin-focus).
- `dsh.client` manifest + `./client` export + optional client peerDependencies; `zod` dependency for the projection schema.
- Pure helpers `computeSeries` / `buildDashboard` in `lib/trends.js` with unit tests.

## [0.1.0] — 2026-08-17

Initial release.

- `trend_snapshot`: collect the dsh-plugin topic (GitHub search, top 100) + awesome-dsh-plugin listing into an append-only local JSONL history.
- `trend_report`: weekly trend report — new plugins, star gainers, category heat, awesome coverage.
- `trend_watch`: keyword radar for new plugins and star surges.
- 8 core unit tests plus a live end-to-end verified against the GitHub API.