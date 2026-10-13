# willie.page Cloudflare migration design

## Goal and acceptance

Move the current personal website off Vercel hosting and Vercel Blob without losing the live Next.js, IndieWeb, AT Protocol, writing, search, status, or protocol behavior. `willie.page` remains the canonical origin. Success requires a deployed Cloudflare Worker serving the full application, working writes against retained Postgres data, working media uploads to R2, verified release notifications, host redirects, and social images. A local build alone is insufficient.

## Recovered context

The September 14 Claude conversation on WillieMac (`72d2d6cf-f0d5-4ec6-a610-d3d4707a825f`) recalled `recovery/willie-page-relaunch`: a `willie-page` Worker, vinext, Cloudflare Web Analytics, Email Routing, and Vercel as rollback. That branch belongs to an older site. Its Worker configuration and runbook are reference material, not a patch to apply. The current `docs/deploy.md` records an unexecuted OpenNext spike. The present app is Next.js 16.3.8 with Cache Components, dynamic social images, `next/after`, and stateful publishing. OpenNext adapts its existing build and documents those features; choose it for this migration. Revisit vinext separately after route parity is demonstrated.

## Runtime and data boundaries

- Build the Next.js app with `@opennextjs/cloudflare` and package its static assets with the Worker. Cache Components must be disabled for the current adapter; keep user-facing routes and local `next dev`, `next build`, and CI checks usable.
- Put mutable Next.js cache data in Cloudflare R2, with revalidation behavior tested on the Worker runtime. Keep previews isolated from production bindings and data.
- Replace runtime `@vercel/postgres` access with `pg` through one application database module. Workers connect through Hyperdrive with request-scoped clients; local scripts use a direct Postgres URL. Preserve connection-pinned transactions, advisory locks, SQL parameterization, and typed results. The retained production Neon project is owned directly in Willie's Neon organization, separate from Vercel. Do not substitute D1 for Postgres-specific behavior.
- Store new Micropub uploads in a private R2 bucket and serve them through an explicit public media path on `willie.page`, with type, size, cache, and key validation. The current public Vercel Blob store is empty; check stored references before removing its token and integration.
- Replace Vercel Analytics and Speed Insights with Cloudflare Web Analytics. Retain Google Analytics only when explicitly configured.
- Embed the release commit in the Worker build and use it for `/api/indieweb/revision`, notify authorization, and preview-to-production matching. Publishing continues only after the exact deployed revision is observed.

## Release and recovery

Publish a candidate Worker on a noncanonical hostname with separate secrets, R2, cache, and database access. Verify homepage, search, feeds, IndieAuth, Webmention, Micropub, AT Protocol, MCP, metadata, social images, redirects, 404s, and mutation paths with safe test identities. Check logs, latency, and retained data. Then attach and verify `willie.page` and alias hosts, run public smoke checks and a controlled publishing action. Cloudflare is the sole deployment target. Retire Vercel hosting, Blob writes, and billable resources after proving the migrated data and public routes.

## Constraints and open provider facts

The personal Cloudflare account is WillieCubed (`18f90fa11cf0a87145be4a1517e41217`) and has Workers Paid. The $25 alert is informational, not a hard spending cap. Production Neon is `icy-sound-09771903` and acceptance is `shiny-scene-02090850`; each has its own Hyperdrive and R2 bindings. The public Vercel Blob store has no objects. Vercel Secret variables cannot be read back through its CLI; first-party keys need rotation, and GitHub and Bluesky credentials need owner replacement. Verify these before DNS cutover. Preserve unrelated changes in both main checkouts and all Claude worktrees.
