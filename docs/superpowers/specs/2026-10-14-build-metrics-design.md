# Cloudflare build metrics design

## Goal

Keep comparable measurements for the Cloudflare build so regressions in build time, shipped bytes, source size, or browser loading are visible across CI runs.

## Scope

- Measure the production Cloudflare Worker build, including build duration, Worker JavaScript bytes, static asset bytes, and tracked first-party TypeScript, TSX, and CSS lines.
- Measure lab loading performance against the local Cloudflare preview for a small, fixed route set. Record TTFB, FCP, LCP, and CLS as informational values.
- Publish a machine-readable report and a short GitHub Actions summary for each metrics run. Keep the JSON report as a workflow artifact.
- Treat LOC and lab performance as informational. Gather a baseline before considering budgets or required CI thresholds.
- Keep Cloudflare Web Analytics as the source for visit analytics. This change does not add a browser analytics script or claim that lab measurements represent real visitors.

## Constraints

- Measure `pnpm build:cloudflare`, which produces `.open-next`, rather than relying on the existing Next.js-only `pnpm build` output.
- Report Worker bytes and static asset bytes separately; do not label their uncompressed sum as transfer size.
- Count only tracked first-party files under `app/`, `components/`, and `lib/`; exclude tests, generated output, dependencies, Markdown, and lockfiles.
- Do not introduce arbitrary size or speed budgets before a stable baseline exists.
- Metrics collection must not deploy a Worker, change provider state, or read credentials.
