# Contributing

- `lib/trends.js`, `lib/storage.js`, `lib/github.js` are dependency-free and unit-tested in `test/trends.test.mjs`.
- `lib/index.js` is the Cordis plugin (tools + prompt section).
- Run `node test/trends.test.mjs` (main-module mode; `node --test` spawns child processes blocked under the DSH sandbox).
- New analysis logic goes into `lib/trends.js` with fixture-based tests.
