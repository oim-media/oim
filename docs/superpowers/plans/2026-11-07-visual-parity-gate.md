# Visual Parity Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A blocking CI gate that compares every renderer's painting of the conformance vectors against web-player goldens published in `@oim-media/spec`.

**Architecture:** One zero-dependency comparator (`packages/spec/tools/parity.mjs`) owns the metric. Renderers only produce PNGs: the web via a Playwright script, Flutter via an opt-in widget test. A new `parity` CI job on the WSL runner chains them.

**Tech Stack:** Node ≥ 20 (`node:zlib`, `node:test`), Playwright + Chromium, Flutter test, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-07-visual-parity-gate-design.md`

## Global Constraints

- Metric: equal sizes; pixel differs if any channel delta > 40/255; 3×3 erosion; fail if eroded area > 0.5 % or any 4-connected blob > 576 px.
- Render procedure: 800 CSS px wide, DPR 1, animations off, default language and palette, base image shown, over `#FFFFFF`, after fonts/images load.
- Goldens are regenerated only on the WSL runner's Linux, never Windows.
- `playwright` pinned exact, ≥ 2 weeks old; pnpm only.
- New files carry `Copyright (c) 2026 Xue Studios LLC` + `SPDX-License-Identifier: Apache-2.0`.
- Fork PRs skip the `parity` job.

## Review Focus

- A PNG with a palette/16-bit/interlaced encoding (e.g. a third party's renderer output) → clear "unsupported PNG" failure, not a crash or false pass. Test in Task 1.
- Renderer output 1 px off in height (rounding of aspect ratio) → size failure naming both sizes. Test in Task 1.
- A fully transparent render (RGBA, alpha 0) → compared after compositing over white, not as black. Test in Task 1.
- Exceptions file naming a vector that no longer exists → failure ("unknown vector in exceptions"). Test in Task 2.
- Web player still loading fonts when screenshotted → flaky goldens. Task 3 waits on `document.fonts.ready` and the player's ready event; self-check run twice must agree.

Note: the spec mentions `tools/pack-contents.mjs`; it does not exist. Ruling: only add `tools/parity.mjs` to `files` in `package.json`.

---

### Task 1: PNG codec and metric

**Files:**
- Create: `packages/spec/tools/parity-core.mjs`
- Test: `packages/spec/tools/parity-core.test.mjs`

**Interfaces:**
- Produces: `decodePng(buf: Buffer) -> {width, height, rgba: Uint8Array}` (throws `Error('unsupported PNG: …')`); `encodePng({width, height, rgba}) -> Buffer`; `compare(golden, render) -> {ok: boolean, reason?: string, area: number, largestBlob: number, mask: Uint8Array}`. RGBA inputs are composited over white before comparing.

- [ ] **Step 1: Write failing tests** (`node:test`), building images with `encodePng`:
  - `identical images pass` → `ok === true, area === 0`.
  - `1px antialias line is ignored` → a 1-px-wide line of delta 255 across 100×100 → `ok === true`.
  - `30x30 block fails on blob` → `ok === false, largestBlob > 576`.
  - `scattered 3x3 dots fail on area` → many separated 3×3 dots totalling > 0.5 % after erosion, no blob > 576 → `ok === false`.
  - `delta 40 is equal, 41 differs`.
  - `size mismatch` → `reason` contains `100x100` and `100x101`.
  - `transparent equals white`.
  - `unsupported PNG` → palette PNG bytes (colour type 3) → throws `/unsupported PNG/`.
- [ ] **Step 2: Run** `node --test packages/spec/tools/` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** in `parity-core.mjs`: decode 8-bit colour types 2 and 6, non-interlaced, all five filters (Paeth included); encode with filter 0. Erosion keeps a pixel only if its full 3×3 neighbourhood differs (border pixels are dropped). Blobs by iterative 4-connected flood fill.
- [ ] **Step 4: Run** — Expected: PASS 8/8. Mutate: change `> 40` to `>= 40` → one test must fail; revert.
- [ ] **Step 5: Commit** `feat(spec): PNG codec and visual parity metric`

### Task 2: `parity.mjs` CLI with exceptions

**Files:**
- Create: `packages/spec/tools/parity.mjs`, `packages/spec/vectors/golden/exceptions.json` (`{}`)
- Modify: `packages/spec/package.json` (`files` += `tools/parity.mjs`, `tools/parity-core.mjs`; `scripts.parity`)
- Test: `packages/spec/tools/parity.test.mjs`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `runParity({rendersDir, renderer, outDir, goldenDir, vectorsDir}) -> {failures: string[], lines: string[]}`; CLI `node parity.mjs <renders-dir> --renderer <name> [--out <dir>]`, exit 1 if `failures.length`.

- [ ] **Step 1: Failing tests** with a temp golden dir of two tiny vectors:
  - `missing render fails` → failure mentions `missing render`.
  - `orphan golden fails` → golden without `vectors/<name>.oim.png` → `orphan golden`.
  - `vector without golden fails` → `no golden for`.
  - `excepted mismatch does not fail`.
  - `excepted vector that passes fails` → `remove the exception`.
  - `unknown vector in exceptions fails`.
  - `writes diff png` → `<out>/<name>.diff.png` exists and decodes.
- [ ] **Step 2: Run** `node --test packages/spec/tools/` — FAIL.
- [ ] **Step 3: Implement**; diff image = golden × 0.3 brightness, eroded mask pixels `#FF0000`. One printed line per vector: `<name>  area=<pct>%  blob=<px>  PASS|FAIL|EXCEPTED`.
- [ ] **Step 4: Run** — PASS. Mutate: drop the stale-exception check → its test fails; revert.
- [ ] **Step 5: Commit** `feat(spec): parity CLI with per-renderer exceptions`

### Task 3: Web golden renderer

**Files:**
- Create: `packages/spec/tools/render-web-goldens.mjs`, `packages/spec/tools/render-page.html`
- Modify: `packages/spec/package.json` (devDependency `playwright` exact; script `goldens`: `node tools/render-web-goldens.mjs vectors/golden`)

**Interfaces:**
- Produces: `node render-web-goldens.mjs <out-dir>` writes `<out-dir>/<vector>.web.png` per vector… for goldens; `--suffix ""` writes `<vector>.png` (renders dir format consumed by `parity.mjs`).

- [ ] **Step 1:** Serve `packages/player-oim/dist/oim-player.js` and the vectors with a `node:http` static server on a random port. Page: white body, `<oim-player src=… disable-animations="true">` sized 800 px wide; viewport DPR 1. Wait for `document.fonts.ready` and the player's ready/rendered event (check `player-oim` source for its exact name), then element screenshot.
- [ ] **Step 2: Run on WSL** `pnpm --filter @oim-media/spec goldens` — Expected: 1 PNG per `vectors/*.oim.png`, each 800 px wide. Inspect 3 by eye against the live player.
- [ ] **Step 3: Determinism check:** render twice to temp dirs, `parity.mjs <dir2> --renderer web` against dir1-as-golden → all PASS with `area=0.000%`.
- [ ] **Step 4:** Measure `du -sh vectors/golden`; if > 5 MB, stop and report (spec risk).
- [ ] **Step 5: Commit** goldens + script `feat(spec): web goldens for the conformance vectors`

### Task 4: Flutter adapter

**Files:**
- Create: `sdks/flutter/test/visual_parity_test.dart`

**Interfaces:**
- Produces: `build/parity/flutter/<vector>.png` (sdks/flutter-relative), size equal to the golden's.

- [ ] **Step 1:** For each `../../packages/spec/vectors/*.oim.png`: read golden size from `vectors/golden/<name>.web.png` header; `ColoredBox(white)` → `SizedBox(w,h)` → `OimPlayer(bytes, showBaseImage: true)` inside `MediaQuery(disableAnimations: true)`; `pumpAndSettle`, capture via `RepaintBoundary.toImage` in `runAsync` (pattern: `test/play_badge_test.dart`), write PNG. Skip whole file unless `Platform.environment['OIM_PARITY'] == '1'`.
- [ ] **Step 2: Run** `OIM_PARITY=1 flutter test test/visual_parity_test.dart` then `node ../../packages/spec/tools/parity.mjs build/parity/flutter --renderer flutter --out build/parity/diff`. Record each FAIL; add true gaps (e.g. artistic-text) to `exceptions.json` with reason and date `2026-11-07`; any other FAIL is a Flutter bug → report, don't except.
- [ ] **Step 3: Acceptance calibration:** reintroduce each of the five 2026-11-06 bugs one at a time (revert the fix hunks of #90/#92) → parity must FAIL on at least one vector each. If a bug has no covering vector, add a minimal vector in `packages/spec/vectors` (with its `.expected.json`) and regenerate its golden. Record measured area/blob per bug in `CANONICAL_SPEC.md` (new section "Visual conformance" with the procedure and metric).
- [ ] **Step 4: Commit** `test(flutter): visual parity renders` + `docs(spec): visual conformance procedure`

### Task 5: CI job

**Files:**
- Modify: `.github/workflows/ci.yml` (new job `parity`), `packages/spec/README.md` (one-time runner setup)

- [ ] **Step 1:** Job `parity`: `if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository`; `runs-on: ${{ vars.CI_RUNNER }}`. Steps mirror `test` (checkout, pnpm, node, install, `pnpm build`), then web self-check (`render-web-goldens.mjs $RUNNER_TEMP/web --suffix ""` + `parity.mjs … --renderer web`), `./.github/actions/setup-flutter`, the Flutter test and `parity.mjs --renderer flutter`; `actions/upload-artifact` (SHA-pinned, same as elsewhere in the repo) of the diff dirs `if: failure()`.
- [ ] **Step 2:** Ask Josué to run once on WSL: `pnpm --filter @oim-media/spec exec playwright install --with-deps chromium` (sudo).
- [ ] **Step 3:** `wsl -d Ubuntu true`, push branch, open PR; Expected: `parity` green.
- [ ] **Step 4:** Mutation in CI: a throwaway commit swapping one golden for another vector's → `parity` red with a diff artifact; drop the commit.
- [ ] **Step 5:** Merge when green.
