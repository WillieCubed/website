# willie.page Cloudflare Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the current willie.page application and its media delivery on Cloudflare, preserve the retained publishing data, and verify the public cutover.

**Architecture:** OpenNext packages the current Next.js build for Workers. A single SQL module uses `pg` and Hyperdrive in Workers, with direct Postgres locally. R2 holds mutable cache and media. Exact build revisions and hosted checks gate activation, with Vercel available for rollback until data and routes are proven.

**Tech Stack:** Next.js 16.3.8, OpenNext Cloudflare adapter, Wrangler, Workers, R2, Hyperdrive, `pg`, GitHub Actions, Playwright.

**Spec:** [2026-10-13-cloudflare-migration-design.md](../specs/2026-10-13-cloudflare-migration-design.md)

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
5. A stale cache after publication must not hide a writing or reply: test tag revalidation across two Worker requests.

---

### Task 1: Baseline and provider inventory

**Files:** Update `docs/deploy.md`; create an inventory receipt in `docs/evidence/` without credentials.

**Interfaces:** Produces the account, zone, database, blob, and deployment identifiers used by later tasks.

- [x] Locate local and WillieMac Claude conversations and worktrees, the recovered branch, and the current deployment guide.
- [x] Establish clean isolated branch and identify current live Vercel service.
- [ ] Read personal Cloudflare zone and account configuration, Vercel project/deployment, Postgres ownership and backup, Blob inventory, and GitHub environment access without revealing secrets.
- [ ] Record route and response baselines, retained data counts, and the rollback target.

### Task 2: Worker build and preview runtime

**Files:** Create `wrangler.jsonc`, `open-next.config.ts`, `public/_headers`; modify `package.json`, `pnpm-lock.yaml`, `.gitignore`, and `next.config.ts` only where the adapter requires it. Add focused runtime smoke tests.

**Interfaces:** Produces `pnpm build:cloudflare`, `pnpm preview:cloudflare`, and `pnpm deploy:cloudflare` and a Worker revision value.

- [ ] Install pinned compatible OpenNext and Wrangler versions; read the installed Next.js adapter guide.
- [ ] Add Worker and cache bindings with explicit preview and production environments and immutable static asset headers.
- [ ] Build and preview in workerd; assert `/`, a dynamic route, a feed, `/_next/image`, a social image, 404, and host redirects.
- [ ] Fix adapter/runtime incompatibilities without weakening features or tests.

### Task 3: Postgres portability

**Files:** Create `lib/db/postgres.ts`; modify runtime database imports under `lib/`; update database tests and maintenance scripts as needed.

**Interfaces:** Produces `sql` tagged queries, `sql.query`, `sql.connect`, and `createPool` with parameterized `pg` queries and connection-pinned transactions.

- [ ] Write focused tests for placeholder conversion, query results, transaction pinning, release, and failure cleanup.
- [ ] Implement the narrow compatibility module using Hyperdrive in Workers and direct URL locally.
- [ ] Replace runtime `@vercel/postgres` imports; rerun DB unit/integration tests against an isolated Postgres instance.
- [ ] Verify real read, write, and lock behavior through the candidate Worker and retained schema.

### Task 4: R2 media and analytics

**Files:** Modify `lib/indieweb/media.ts`, `lib/indieweb/media-endpoint.ts`, `app/layout.tsx`, `.env.example`, `package.json`; create a media delivery route and tests.

**Interfaces:** `getMediaStore()` returns R2 in Workers and a controlled local store for tests; public media URLs are under `willie.page`.

- [ ] Test media key validation, MIME and cache headers, random collision resistance, upload failure, and delivery.
- [ ] Implement R2 write/read and retain the existing 4 MiB and signature checks.
- [ ] Remove Vercel analytics and Blob runtime dependencies; add Cloudflare analytics only on production.
- [ ] Inventory and copy existing blobs, verify hashes and references, and document a reversible URL transition before closing the old store.

### Task 5: Revision, automation, and release controls

**Files:** Modify `app/api/indieweb/revision/route.ts`, `lib/indieweb/notify.ts`, `app/api/studio-publication/[slug]/route.ts`, `.github/workflows/indieweb-publish.yml`; add a deployment workflow and tests.

**Interfaces:** All revision consumers read one baked SHA; deploy produces an immutable candidate and promotion references that SHA.

- [ ] Test the exact-SHA notification gate and preview/production environment separation.
- [ ] Implement the build revision and Cloudflare deploy workflow with scoped GitHub environments and no secrets in pull requests.
- [ ] Deploy candidate, verify full route matrix and publishing on isolated data, and retain diagnostic receipts.
- [ ] Promote the verified artifact to canonical and alias hosts; check public routes, writes, DNS, analytics, logs, and rollback.

### Task 6: Retire Vercel dependencies

**Files:** Update `docs/deploy.md`, `README.md`, `docs/bootstrap.md`, `.env.example`, and scripts; remove `vercel.json` only after the rollback window.

**Interfaces:** The runbook states current provider ownership, recovery commands, and retained-data locations.

- [ ] Confirm independent Postgres ownership and restore a representative backup into isolation.
- [ ] Verify all legacy blob URLs or migrated replacements and stop Vercel Blob writes.
- [ ] Remove Vercel project integration, stale configuration, and billable resources only after production evidence and rollback readiness.
- [ ] Run `pnpm check`, browser smoke, provider checks, and `scripts/hypertext-gate.py` if installed; record exact remaining limitations.
