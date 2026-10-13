# willie.page Cloudflare migration design

## Goal and acceptance

Move the current personal website off Vercel hosting and Vercel Blob without losing the live Next.js, IndieWeb, AT Protocol, writing, search, status, or protocol behavior. `willie.page` remains the canonical origin. Success requires a deployed Cloudflare Worker serving the full application, working writes against retained Postgres data, working media uploads to R2, verified release notifications, host redirects, social images, and a tested rollback route. A local build alone is insufficient.

## Recovered context

The September 14 Claude conversation on WillieMac (`72d2d6cf-f0d5-4ec6-a610-d3d4707a825f`) recalled `recovery/willie-page-relaunch`: a `willie-page` Worker, vinext, Cloudflare Web Analytics, Email Routing, and Vercel as rollback. That branch belongs to an older site. Its Worker configuration and runbook are reference material, not a patch to apply. The current `docs/deploy.md` records an unexecuted OpenNext spike. The present app is Next.js 16.3.8 with Cache Components, dynamic social images, `next/after`, and stateful publishing. OpenNext adapts its existing build and documents those features; choose it for this migration. Revisit vinext separately after route parity is demonstrated.

## Runtime and data boundaries

- Build the unchanged Next.js app with `@opennextjs/cloudflare`. Package its static assets with the Worker. Keep local `next dev`, `next build`, and the existing CI checks usable.
- Put mutable Next.js cache data in Cloudflare R2, with revalidation behavior tested on the Worker runtime. Keep previews isolated from production bindings and data.
- Replace runtime `@vercel/postgres` access with `pg` through one application database module. Workers connect through a Hyperdrive binding; local and maintenance scripts use a direct Postgres URL. Preserve connection-pinned transactions, advisory locks, SQL parameterization, and typed results. Keep the existing Postgres data and schema through the first hosting cutover. Later detach the database's account ownership from Vercel or restore it to an independently owned Postgres instance; do not substitute D1 for Postgres-specific behavior.
- Store new Micropub uploads in a private R2 bucket and serve them through an explicit public media path on `willie.page`, with type, size, cache, and key validation. Existing public Vercel Blob URLs remain reachable during a verified copy and URL migration; do not delete the old store first.
- Replace Vercel Analytics and Speed Insights with Cloudflare Web Analytics. Retain Google Analytics only when explicitly configured.
- Embed the release commit in the Worker build and use it for `/api/indieweb/revision`, notify authorization, and preview-to-production matching. Publishing continues only after the exact deployed revision is observed.

## Release and recovery

Publish a candidate Worker on a noncanonical hostname with separate secrets, R2, cache, and database access. Verify homepage, search, feeds, IndieAuth, Webmention, Micropub, AT Protocol, MCP, metadata, social images, redirects, 404s, and mutation paths with safe test identities. Check logs, latency, and retained data. Then attach and verify `willie.page` and alias hosts, run public smoke checks and a controlled publishing action, and keep Vercel as a temporary rollback. Remove Vercel billing/storage/deployment dependencies only after the retained database and blob migration are verified and the rollback window closes.

## Constraints and open provider facts

The current Wrangler OAuth session exposes only the LVBT account; it must not be used to deploy the personal site. Resolve an authorized personal Cloudflare account identity before provisioning or DNS cutover. Confirm the existing Postgres provider, backup/export path, Blob inventory, Cloudflare zone access, and personal-domain email routing from provider state. Do not copy credentials from another host or browser session into a shell. Preserve unrelated changes in both main checkouts and all Claude worktrees.
