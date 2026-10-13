# Deploying willie.page

This page is for whoever deploys the site or changes a domain. Read it before
touching DNS, the Worker, or the redirect table in `next.config.ts`.

## Where things run

The Next.js app is the whole site. The static Cloudflare Worker that served
the homepage prototype on willie.page is retired; the homepage is now the
`/` route.

| Host                  | Role                                 | Where it is configured               |
| --------------------- | ------------------------------------ | ------------------------------------ |
| `willie.page`         | canonical origin                     | `lib/site.ts` (`site.origin`)        |
| `www.willie.page`     | 308 to the apex, path for path       | `site.legacyHosts`, `next.config.ts` |
| `williecubed.me`      | 308 to willie.page, path for path    | `site.legacyHosts`, `next.config.ts` |
| `www.williecubed.me`  | 308 to willie.page, path for path    | `site.legacyHosts`, `next.config.ts` |
| `tour.willie.page`    | 307 to `/initiatives/fall-tour-2026` | `site.aliasHosts`, `next.config.ts`  |
| `diaries.willie.page` | 307 to `/initiatives/twd`            | `site.aliasHosts`, `next.config.ts`  |

Alias hosts are temporary redirects on purpose: `tour.willie.page` points at
whichever tour is current, and next year that path changes.

The redirect table is code. Adding a host means one line in `lib/site.ts`
and then attaching the hostname to the hosting project so requests for it
reach the app at all. A redirect rule for a host that is not attached does
nothing.

The same table sends `/apps` to `/projects` with a 307 while `/projects`
is rebuilt. `/media` is a page that lists media mentions and appearances.

## Hosting: Cloudflare Workers

OpenNext packages the Next.js app for the `willie-page` Worker. The deployment
source of truth is `cloudflare.config.ts`; its `preview` mode selects the
isolated `willie-page-preview` Worker. `wrangler.config.ts` holds bundler
settings for the beta `cf` CLI, while `wrangler.jsonc` and
`wrangler.preview.jsonc` remain for OpenNext's adapter build. Build with
`pnpm build:cloudflare`, deploy with
`pnpm deploy:cloudflare` (or `pnpm deploy:cloudflare:preview`), and verify
the baked commit SHA at `/api/indieweb/revision`. Do not build once and deploy
the same `.open-next` directory to both environments: the public origin and
revision are compiled into the build.

After a hosted deployment, run the read-only route gate with the exact full
commit SHA:

```sh
pnpm exec tsx scripts/cloudflare/verify-public-routes.mts --sha "$(git rev-parse HEAD)"
pnpm exec tsx scripts/cloudflare/verify-public-routes.mts --origin https://willie.page --sha "$(git rev-parse HEAD)"
```

The first command checks the isolated preview. The second is for the canonical
host after cutover. Each checks the deployed revision, Worker binding marker, Cloudflare server,
IndieAuth issuer, public route matrix, redirects, and unauthenticated admin
response. Use `--output <private-path>` to save a receipt. Passing this gate
does not prove authenticated writes, media upload, or database usage.

Create the named WillieCubed profile with `pnpm exec cf auth create williecubed`
after approving its OAuth permissions. `cf auth login` only updates the default
profile; `--profile` does not turn it into a named-profile login. Verify the
new profile's account ID is `18f90fa11cf0a87145be4a1517e41217` with
`pnpm exec cf auth whoami --profile williecubed`. Set
`CLOUDFLARE_PROFILE=williecubed` when running the deploy script locally. The
config also pins that account ID, so a login from another Cloudflare account cannot
silently deploy the personal site there. The `cf` CLI has separate credentials
from Wrangler. The OpenNext adapter still requires Wrangler to produce its
bundle, and `cf` uses the Wrangler bundler. Do not run `cf init .` here; this
project was converted with `cf migrate` and its Durable Object exports were
reviewed. `cf` is currently beta, so validate both modes with a dry run and
hosted checks after each CLI update.

Cloudflare owns DNS, Worker delivery, R2 media, cache storage, and Web
Analytics. The production Neon project remains owned in Willie's Neon
organization; Workers reach it through the production Hyperdrive binding.
Preview has its own Neon project, Hyperdrive, cache bucket, media bucket,
Durable Objects, secrets, and public origin. Build it with
`pnpm build:cloudflare:preview` before deploying with the preview config.
Local development uses a direct `POSTGRES_URL`.
The public media store is R2 and `/media/*` serves validated immutable keys.

The Worker needs these secrets: `ATPROTO_OAUTH_JWK`,
`ATPROTO_OAUTH_STORAGE_KEY`, `WEBMENTION_SECRET`,
`WEBMENTION_MODERATION_SECRET`, `INDIEAUTH_INTROSPECTION_SECRET`,
`INDIEWEB_NOTIFY_SECRET`, `SEARCH_REINDEX_SECRET`,
`INDIEAUTH_TOTP_SECRET`, `MICROPUB_GITHUB_TOKEN`, and
`ATPROTO_APP_PASSWORD`. `cf` cannot set one secret in the current beta; use
`wrangler secret put` with the explicit Worker name, or supply a private
`--secrets-file` to `cf deploy`. Never put values in the repository or command
arguments. `INDIEWEB_NOTIFY_SECRET_PRODUCTION` in GitHub Actions must match the
production Worker secret. Rotating the OAuth storage key signs existing
Standard.site subscribers out; they must authorize again.

Cloudflare Workers Builds should connect `WillieCubed/website` to the
production Worker on `main`. Its build command is `pnpm build:cloudflare` and
deploy command is `pnpm deploy:cloudflare`. Set `PNPM_VERSION` to the
`packageManager` version in `package.json`. Connect the preview Worker with
deploy command `pnpm deploy:cloudflare:preview` and
build command `pnpm build:cloudflare:preview`. The IndieWeb notification GitHub Action polls the
canonical revision after each `main` push and invokes the production Worker
only when the exact SHA is live. Check the Cloudflare build and the GitHub
Action on a real publish; a successful build alone is not publication proof.

The deploy scripts supply a placeholder loopback Postgres URL only to the
local Wrangler proxy that OpenNext starts while preparing a remote upload.
The deployed Workers use the Hyperdrive IDs in `cloudflare.config.ts`; the
placeholder is never a production database credential. Bare `cf deploy`
fails at that local proxy preflight when no local connection string is set.

On the current Worker architecture, Workers Free's 10 ms CPU limit is too
small for some dynamic requests. WillieCubed billing confirmed Workers Paid
subscribed on October 13. It includes 10 million requests and 30 million CPU
milliseconds per month; static asset requests are free. The billing dashboard
showed two $10 budget alerts, both notifications rather than hard limits.
R2 Paid and Images Stream Basic were also listed as subscriptions. Hyperdrive
queries and connection pooling have no separate charge on Workers Paid. The
SQLite Durable Objects used by the Next cache have their own included monthly
allowance: one million requests and 400,000 GB-seconds of duration. Watch
Worker requests and CPU, Durable Object requests and duration, R2 operations
and storage, and Images transformations after cutover. The owner's $25 monthly
ceiling cannot be enforced by a budget alert; pause new billable use or change
the architecture before projected charges approach it.
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
charges $0.30 per million requests beyond the included 10 million and $0.02
per million CPU milliseconds beyond the included 30 million. The recent 2.1
million Vercel function invocations are only a rough traffic reference, not a
Worker usage forecast. Measure the account-wide request and CPU totals after
cutover; other Workers share the paid allowance. [R2 Standard's free
allowance](https://developers.cloudflare.com/r2/pricing/) is 10 GB-month,
one million Class A operations, and ten million Class B operations monthly.
[Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/)
and [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
document the included usage and possible overages.

Neon is a separate Free account. Its October 2026 allowance is 100 compute
unit hours and 1 GB of storage **per project** each month. On
October 13, the Neon API reported production 10,951 compute seconds (3.04
CU-hours) and 32.6 MB of storage; acceptance 11,116 compute seconds (3.09
CU-hours) and 33.2 MB; private writing 1,899 compute seconds (0.53 CU-hours)
and no storage. These are pre-cutover figures. Read `compute_time_seconds`,
the CU-weighted usage field, rather than `active_time_seconds`, which is
unweighted uptime. Check each project without waking its compute, for example:

```sh
npx -y neonctl@latest projects get icy-sound-09771903 --output json |
  jq '{name, compute_time_seconds, synthetic_storage_size, consumption_period_end}'
```

Divide `compute_time_seconds` by 3,600 for CU-hours and compare each project
to its own 100 CU-hour allowance. The production compute is fixed at 0.25 CU
and was idle when checked. The isolated preview compute was capped at 0.25 CU
on October 13; all three computes were idle and had scale to zero enabled
when checked. Neon's API value
`suspend_timeout_seconds: 0` uses the plan default idle timeout. A 0.25 CU
compute kept awake all month would consume roughly 186 CU-hours, exceeding
the Free allowance after roughly 400 active hours, or about 17 continuously
active days. Avoid frequent database polling and keep scale to zero enabled.
The public footer's location read uses the shared Next data cache for three
hours; an owner city save invalidates its tag. Verify the hosted cache and
fresh city update before canonical DNS moves. Writing detail pages still
revalidate every minute, while the reply-context database read has a separate
three-hour data cache. Approved Webmentions for all public pages and
feeds share a one-hour snapshot in the private R2 cache bucket. A verified
public change or API moderation rotates its generation and invalidates the
affected page. The snapshot's Postgres query bypasses Hyperdrive's separate
SELECT cache so the first read after moderation sees the committed data. Direct
database moderation from a local script may take up to one hour to appear.
Native Bluesky repost receipt reads and writes use a separate one-hour Next
data cache keyed by the post and observed actor set; a newly discovered actor
set records receipts on its first read. Malformed Webmention POSTs are rejected
before the database-backed rate counter; acceptable submissions still wake
Neon. A Cloudflare rate-limiting binding rejects bursts above ten acceptable
submissions per minute per client IP before reaching Postgres. The database
counter remains authoritative: Cloudflare's binding is approximate and local
to each edge location. Both counters key Cloudflare traffic by
`CF-Connecting-IP` instead of a client-supplied first `X-Forwarded-For`
address. A steady low-rate sender can still keep Neon awake; if that happens,
enforce a zone rule before the Worker or move incoming verification off the
database path. Hosted proof
of these caches, invalidation, and Webmention rejection is required before
cutover. Other authenticated operations can still wake Neon. After cutover,
inspect each Neon project's compute and
storage at least daily for the first week. Project the current CU-hour rate
through the end of the billing period; if the projection reaches 80 CU-hours
or storage reaches 800 MB, find the hot read before the Free limit interrupts
database-backed features. Reduce its refresh frequency or move that workload
to a budgeted paid service before Free is exhausted.
Cloudflare budget alerts do not cover Neon.

The read-only budget check records both website projects without waking their
computes. Save a fresh receipt daily and compare it with the previous receipt
to project month-end usage:

```sh
pnpm exec tsx scripts/cloudflare/check-neon-free.mts \
  --output /tmp/willie-neon-$(date -u +%Y%m%d).json \
  --previous /tmp/willie-neon-YYYYMMDD.json
```

Omit `--previous` for the first check. The command exits 2 at 80 CU-hours,
an 80 CU-hour month-end projection, or 800 MB in either project. Keep receipts
outside the repository. A day between samples gives a useful rate; a near
instant comparison reports current usage without a forecast; the script
requires at least six hours between samples to project month-end usage.

The production database has a tested logical backup path: on October 13 a
`pg_dump` custom archive restored successfully into temporary local
PostgreSQL 18, with all 20 public tables and 8 rows matching. The temporary
archive was deleted. Neon Free offers a six-hour point-in-time restore
window, so a retained off-site backup remains necessary for longer recovery
and before destructive schema changes.

The [Images pricing](https://developers.cloudflare.com/images/pricing/)
includes the first 5,000 unique transformations per month on both Free and
Paid. WillieCubed billing lists Images Stream Basic, while the Images plan
screen showed no hosted-image storage selected and $0 base for storage.
Treat usage beyond 5,000 as potentially billable until the account's exact
transformation tier is confirmed: Free rejects new variants with error 9422,
while Paid charges $0.50 per additional 1,000 transformations.
`next.config.ts` limits generated widths to twelve and allows only qualities
75 and 90. Keep static assets on the Assets binding so they do not invoke the
Worker, and check Images usage along with Worker CPU after cutover. On October
13 the Images dashboard showed 3 unique transformations in the current month.
This is an early candidate-only reading, not a production traffic estimate.

Remote YouTube posters bypass optimization, and there is no remote image
allowlist in the Next.js optimizer. Only local site images use the Images
binding; this prevents arbitrary remote thumbnail URLs from consuming unique
transformations.

At the current 12 widths and 2 qualities, one original image can create up to
24 variants; review this limit as content grows. Do not send authenticated or
mutable responses through a shared edge cache to reduce
a bill.
There were 112 raster files under `public/` on October 13, so even if every
one were requested in all 24 allowed width/quality combinations, those files
would use at most 2,688 monthly unique transformations. R2 uploads and remote
YouTube images add to that count; the dashboard, not this upper bound, is the
source of actual usage. If the month approaches 4,000 transformations, reduce
new variants or make an explicit Images plan decision before publishing more
images. Depending on the account's Images tier, exceeding 5,000 either risks
new-image failures or paid overage; neither should be the default cost plan.

Cloudflare Web Analytics already has automatic setup enabled for `willie.page`
in the WillieCubed account and was recording visits before cutover. It does not
need a new application script. Verify it continues to receive visits after the
custom domain moves to the Worker.

Do not enable Workers Caching for this whole Worker. Its default policy can
cache responses without explicit headers, including account routes, and its
default key does not distinguish the redirect hosts. Static files already use
the free Assets binding. If runtime metrics justify more caching, scope it to
public feed or media paths, use a host-aware key, and verify a hosted cache
hit and invalidation before relying on it for cost control.

IndieWeb's public URL fetch uses a connection-time DNS guard in Node.js. In
Workers, `dns.lookup` is unavailable; the URL guard rejects private IP
literals and localhost names, while Cloudflare's public-only fetch proxy
enforces the destination boundary. Keep the `global_fetch_strictly_public`
flag on both Workers so same-zone fetches also go through the public front
door. A hosted Webmention fetch is part of preview acceptance.

The `williecubed.me` and `www.williecubed.me` legacy redirect hosts are
attached to the production Worker ahead of the canonical cutover. Their
Cloudflare zone, mail MX records, and AT Protocol identity TXT record were
checked first; neither host had working web DNS before attachment. The `www`
host uses a Custom Domain. The apex uses a Worker route with a proxied `AAAA`
record pointing to the reserved `100::` placeholder: Cloudflare registered
its Custom Domain but did not publish an apex A or AAAA answer. The Worker
always returns the canonical redirect, so no request reaches the placeholder.
The old zone-wide `https://www.*` Redirect Rule is disabled because it
incorrectly included the old hostname in the destination path.

To cut over a verified candidate, add Custom Domains for `willie.page`,
`www.willie.page`, `tour.willie.page`, and `diaries.willie.page` to the
production Worker. Custom Domains replace the old Vercel DNS target
and provision certificates. Keep `workers_dev` enabled for diagnostics. Check
the canonical homepage, feeds, search, image optimization, social images,
IndieAuth, media delivery, Webmention writes, and host redirects through each
public hostname. Then check Cloudflare logs and billing, and remove the old
Vercel project and tokens only after retained data and writes are proven.

## Patched dependencies

`patches/next@16.3.8.patch` (applied by pnpm through `patchedDependencies` in
`pnpm-workspace.yaml`) removes one line from Next's `fetchInternalImage`.

- **The bug.** Next optimizes a local image by fetching it through a mock
  request that reuses the visitor's socket. If the visitor leaves while the
  image is still optimizing, the static file handler sees that socket closed
  and never finishes the mock response. That image's in-flight optimization
  never settles, and every later request for the same size and quality waits
  on it until the server restarts.
- **Who it affects.** This is any `next start` server, which includes the
  Playwright smoke run in CI and any self-hosted or Workers deployment. On
  Vercel, `/_next/image` is served by Vercel's image service and is not
  affected.
- **The fix.** The mock request gets its own placeholder socket instead.
- **How it was found.** CI's "glass previews retain detail at 1x" check hung
  with its three icons pending. On a local `next start`, aborting cold image
  requests wedged 15 of 20 keys before the patch and none after.
- **Next 16.3.8 still has the bug.** Each time Next is upgraded:
  1. Check whether `fetchInternalImage` still passes `socket: _req.socket`.
  2. If it does, regenerate the patch with `pnpm patch next@<version>`.
  3. If it no longer does, delete the patch.

  `pnpm install` fails when a patch no longer applies, so a forgotten patch
  surfaces immediately.

`patches/gray-matter@4.0.3.patch` moves the YAML engine to `load` and
`dump` from js-yaml 4. The scoped override removes js-yaml 3 and its
`argparse` / `sprintf-js` dependency chain. js-yaml 4 uses the same safe
default schema; no JavaScript YAML types are enabled. The patch must stay
paired with the `gray-matter>js-yaml` override. Remove both when
gray-matter supports js-yaml 4 upstream.

The typography plugin also pins an affected selector parser. Its scoped
override selects 7.1.6 until the plugin updates that dependency. A global
sharp override keeps Next's optional image dependency on the patched 0.35.5.

The development-only Next ESLint plugin still depends on braces 3.0.3
through fast-glob. GHSA-vfj7-8cjw-p6xm has no published fix as of October 10, 2026. The plugin reads repository-controlled root-directory patterns; the
site does not expose that parser to visitors. Production dependency audits
pass, but a full audit must continue to report this upstream advisory.

## Open questions

Every address on the site is on willie.page (`hello@`, `projects@`), set
by `NEXT_PUBLIC_EMAIL_HELLO` and `NEXT_PUBLIC_EMAIL_PROJECTS` with those as
defaults (`site.emails` in lib/site.ts), and williecubed.me is legacy: it
only redirects here. Mail to willie.page
needs Cloudflare Email Routing on the zone before these addresses receive
anything. `NEXT_PUBLIC_GTAG_ID` is optional; without
it the layout emits no analytics script.

The AT Protocol identity is configuration too: `NEXT_PUBLIC_ATPROTO_DID` (the
DID `/.well-known/atproto-did` serves) and `NEXT_PUBLIC_BLUESKY_HANDLE`. Both
are inlined at build time, so set them on every environment that builds the
site before deploying; without the DID, the route answers 404 and the site
offers no Bluesky account.
