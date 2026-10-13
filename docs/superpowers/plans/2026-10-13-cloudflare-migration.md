# willie.page Cloudflare Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the current willie.page application and its media delivery on Cloudflare, preserve the retained publishing data, and verify the public cutover.

**Architecture:** OpenNext packages the current Next.js build for Workers. A single SQL module uses `pg` and Hyperdrive in Workers, with direct Postgres locally. R2 holds mutable cache and media. Exact build revisions and hosted checks gate activation. Cloudflare becomes the sole deployment platform.

**Tech Stack:** Next.js 16.3.8, OpenNext Cloudflare adapter, Wrangler, Workers, R2, Hyperdrive, `pg`, Workers Builds, GitHub Actions publishing notifications, Playwright.

**Spec:** [2026-10-13-cloudflare-migration-design.md](../specs/2026-10-13-cloudflare-migration-design.md)

## Current provider facts

The WillieCubed Cloudflare account has Workers Paid, confirmed in Billing on October 13. The dashboard showed two $10 budget alerts, which do not enforce a cap; the owner's $25 monthly ceiling remains a manual release and operations constraint. The paid plan includes 10 million Worker requests and 30 million CPU milliseconds monthly; static asset requests are free. The first hosted preview exceeded the Free plan's 10 ms CPU limit, so the full Next.js Worker is not a reliable Free plan deployment. The live Vercel project recently used about 2.1 million function invocations per month; verify Cloudflare CPU and storage usage after cutover. The production Neon database belongs to Willie's Neon organization, with 20 public tables. The acceptance database had 18 and received the existing status migration to reach 20. The Vercel public Blob store is empty. Vercel Secret values cannot be pulled back, so owner credentials must be replaced before protected routes are accepted.

## Global constraints

- Keep `willie.page` canonical and preserve existing host and feed redirects.
- Keep all public and private publishing behavior, Postgres transactions, and existing content.
- Keep production, preview, and local data and credentials distinct.
- Do not use the LVBT Cloudflare account for the personal site.
- Preserve unrelated worktree changes; use the repository's atomic index-reset staging chain and commit message file.
- Verify runtime, provider, and public behavior separately.

## Review focus

1. An aborted media upload must leave no public incomplete object: test bounded upload failure and R2 store behavior.
2. A concurrent Micropub delete and restore must retain the transaction lock: rerun the Postgres concurrency acceptance cases.
3. A changed deployment between revision discovery and notification must return 409: test with differing SHAs and verify the hosted workflow.
4. A direct Worker URL must not expose any protected preview or owner route: inspect access control on both hostnames.
5. A stale cache after publication must not hide a writing or reply: test the Webmention snapshot generation and page revalidation across two Worker requests.

---

### Task 1: Baseline and provider inventory

**Files:** Update `docs/deploy.md`; create an inventory receipt in `docs/evidence/` without credentials.

**Interfaces:** Produces the account, zone, database, blob, and deployment identifiers used by later tasks.

- [x] Locate local and WillieMac Claude conversations and worktrees, the recovered branch, and the current deployment guide.
- [x] Establish clean isolated branch and identify current live Vercel service.
- [x] Read personal Cloudflare zone and account configuration, Vercel project/deployment, Postgres ownership, Blob inventory, and GitHub environment access without revealing secrets.
- [ ] Record final production route baselines and retained data counts before and after cutover.
- [x] Record the hosted preview route matrix and write receipts in `docs/evidence/cloudflare-preview-2026-10-13.md`.

### Task 2: Worker build and preview runtime

**Files:** Create `wrangler.jsonc`, `open-next.config.ts`, `public/_headers`; modify `package.json`, `pnpm-lock.yaml`, `.gitignore`, and `next.config.ts` only where the adapter requires it. Add focused runtime smoke tests.

**Interfaces:** Produces `pnpm build:cloudflare`, `pnpm preview:cloudflare`, and `pnpm deploy:cloudflare` and a Worker revision value.

- [x] Install pinned compatible OpenNext and Wrangler versions; read the installed Next.js adapter guide.
- [x] Add Worker, Hyperdrive, and cache bindings with distinct preview and production resources and immutable static asset headers.
- [x] Build and deploy the isolated Worker; assert `/`, dynamic routes, feeds, `/_next/image`, social images, expected 404s, and feed redirects.
- [ ] Fix adapter/runtime incompatibilities without weakening features or tests.

### Task 3: Postgres portability

**Files:** Create `lib/db/postgres.ts`; modify runtime database imports under `lib/`; update database tests and maintenance scripts as needed.

**Interfaces:** Produces `sql` tagged queries, `sql.query`, `sql.connect`, and `createPool` with parameterized `pg` queries and connection-pinned transactions.

- [x] Verify parameterized tags, query results, transaction pinning, overlapping advisory locks, and rollback/release after failure against a disposable local PostgreSQL 18 instance in `tests/integration/postgres-portability.test.mts`. Hosted Hyperdrive concurrency acceptance remains open.
- [x] Implement the narrow compatibility module using request-scoped Hyperdrive clients in Workers and a direct URL locally.
- [x] Replace runtime `@vercel/postgres` imports; run the unit suite and a hosted Webmention rate-limit write against isolated Neon.
- [x] Verify real reads and writes through the isolated Worker and retained acceptance schema; IndieAuth authorization, token writes, revocation, and R2 media upload passed. Connection-pinned transaction locks still need a hosted concurrency check.

### Task 4: R2 media and analytics

**Files:** Modify `lib/indieweb/media.ts`, `lib/indieweb/media-endpoint.ts`, `app/layout.tsx`, `.env.example`, `package.json`; create a media delivery route and tests.

**Interfaces:** `getMediaStore()` returns R2 in Workers and a controlled local store for tests; public media URLs are under `willie.page`.

- [x] Test media key validation, MIME and cache headers, random collision resistance, upload failure, and byte-identical delivery in the focused unit suites and the isolated hosted R2 preview.
- [x] Implement R2 write/read and retain the existing 4 MiB and signature checks.
- [x] Verify analytics migration: no Vercel Analytics or Speed Insights runtime
      component/package is present; Cloudflare Web Analytics automatic setup for
      `willie.page` is active and receiving visits. The separate optional Google
      Analytics script remains gated by its explicit measurement ID.
- [ ] Remove the remaining historical `@vercel/blob` package and acceptance
      script after the Vercel project is retired; production media already uses R2.
- [x] Inventory the public Blob store: it has zero objects. Check database/content references before removing the old integration.

### Task 5: Revision, automation, and release controls

**Files:** Modify `app/api/indieweb/revision/route.ts`, `lib/indieweb/notify.ts`, `app/api/studio-publication/[slug]/route.ts`, `.github/workflows/indieweb-publish.yml`; add a deployment workflow and tests.

**Interfaces:** All revision consumers read one baked SHA; deploy produces an immutable candidate and promotion references that SHA.

- [x] Test the exact-SHA notification gate and preview/production environment separation. The notification unit test rejects a mismatched SHA, and separately built production and preview bundles pass isolated `cf` dry runs. A local preview Worker advertises the preview origin and exact build SHA.
- [x] Bake the Git revision into both builds and expose it at `/api/indieweb/revision`.
- [ ] Connect Cloudflare Workers Builds to the scoped repository. Keep GitHub Actions for exact-revision publish notification only.
- [ ] Deploy candidate, verify full route matrix and publishing on isolated data, and retain diagnostic receipts.
- [ ] Promote the verified artifact to canonical and alias hosts; check public routes, writes, DNS, analytics, and logs.

### Task 6: Retire Vercel dependencies

**Files:** Update `docs/deploy.md`, `README.md`, `docs/bootstrap.md`, `.env.example`, and scripts; remove `vercel.json` after Cloudflare cutover.

**Interfaces:** The runbook states current provider ownership, recovery commands, and retained-data locations.

- [x] Confirm independent Neon ownership of production and acceptance projects.
- [x] Restore a representative production backup into isolation. On October 13,
      `pg_dump` and `pg_restore` succeeded in a temporary local PostgreSQL 18
      database; 20 public tables and all 8 rows matched. See the preview
      acceptance receipt for scope and cleanup.
- [ ] Verify all legacy blob URLs or migrated replacements and stop Vercel Blob writes.
- [ ] Remove Vercel project integration, stale configuration, and billable resources after production and retained data are verified.
- [ ] Run `pnpm check`, browser smoke, provider checks, and `scripts/hypertext-gate.py` if installed; record exact remaining limitations.
