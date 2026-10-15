# Cloudflare Build Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retain comparable Cloudflare build and browser loading measurements in CI.

**Architecture:** A small Node script wraps the existing Cloudflare build, records elapsed time and output/source sizes, then writes JSON. A separate measurement script runs the local Cloudflare preview in Chromium against a fixed route set and records browser timing metrics. CI uploads both reports and prints concise summaries; values remain informational until a baseline is established.

**Tech Stack:** Node.js 24, TypeScript, OpenNext Cloudflare, Wrangler preview, Playwright, GitHub Actions.

**Spec:** [2026-10-14-build-metrics-design.md](../specs/2026-10-14-build-metrics-design.md)

## Global Constraints

- Measure `pnpm build:cloudflare`, not only `pnpm build`.
- Keep Worker JavaScript bytes separate from static asset bytes.
- Count tracked first-party TypeScript, TSX, and CSS only under `app/`, `components/`, and `lib/`.
- Do not add metric thresholds until multiple CI runs establish a baseline.
- Do not deploy, change Cloudflare settings, or add client-side analytics instrumentation.

## Review Focus

1. Missing or incomplete `.open-next` output must fail metrics collection with a clear error instead of recording zero bytes.
2. Generated and untracked files must not inflate LOC; cover the tracked-file filter in the collector test.
3. Worker bytes and static asset bytes must remain separate in JSON and the Actions summary.
4. A route without an LCP entry must be reported as unavailable, not as zero; cover a missing-entry result in the browser measurement helper.
5. Preview startup failures and non-2xx routes must fail the metrics job without leaving a background Worker process running.

---

### Task 1: Collect build duration, output bytes, and source LOC

**Files:** Create `scripts/cloudflare/build-metrics.mts`; modify `package.json` and `.gitignore`; create `tests/unit/deploy/cloudflare-build-metrics.test.mts`.

**Interfaces:** The command `pnpm build:metrics` runs the existing production Cloudflare build and writes `artifacts/cloudflare-build-metrics.json`. Ignore the generated `artifacts/` directory. JSON fields: `revision`, `buildMs`, `workerBytes`, `staticAssetBytes`, `staticAssetFiles`, `sourceLines`.

- [x] Test that the collector totals a fixture Worker file and nested static assets separately.
- [x] Test that source LOC includes tracked `.ts`, `.tsx`, and `.css` under `app/`, `components/`, and `lib/` only.
- [x] Test that a missing Wrangler Worker bundle returns a clear error.
- [x] Implement the build wrapper and collector without adding a runtime dependency; use `git ls-files` for the LOC input set.
- [x] Run the focused collector test and `pnpm build:metrics`; inspect the JSON values and confirm the script does not alter tracked build inputs.

### Task 2: Measure browser loading on the Cloudflare preview

**Files:** Create `scripts/cloudflare/preview-metrics.mts`; create `tests/unit/deploy/cloudflare-preview-metrics.test.mts`.

**Interfaces:** The command `pnpm preview:metrics` starts `pnpm preview:cloudflare`, samples `/`, `/search`, and `/writings` five times each in Chromium, and writes `artifacts/cloudflare-preview-metrics.json` with per-route median TTFB, FCP, LCP, and CLS.

- [x] Test median calculation and the missing-LCP representation with deterministic values.
- [x] Implement the preview launcher with readiness polling and guaranteed process cleanup on success, route failure, or timeout.
- [x] Record failed navigations and non-2xx responses as job failures; keep the measurements informational with no budgets.
- [x] Run the focused helper test and the preview measurement command; inspect the JSON for all three routes and four metrics.

### Task 3: Retain and summarize CI measurements

**Files:** Modify `.github/workflows/ci.yml`; modify `package.json` if needed for script names.

**Interfaces:** A `metrics` job builds and measures the local Cloudflare Worker without credentials or deployment. It uploads both JSON reports as workflow artifacts and writes Worker bytes, static asset bytes, LOC, build time, and route medians to `$GITHUB_STEP_SUMMARY`.

- [x] Add a separate informational job for pull requests and pushes to `main`; keep existing `ci` and `smoke` checks unchanged.
- [x] Upload the two JSON files with the workflow's configured artifact retention.
- [ ] Run the workflow commands locally in order and confirm a failed build prevents stale metrics from being uploaded.
- [ ] Gather several main-branch runs before proposing any metric budget or making the job a required check.
