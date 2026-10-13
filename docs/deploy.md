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

Use a WillieCubed `cf` CLI profile for local deployments and verify its
account ID is `18f90fa11cf0a87145be4a1517e41217` with
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
small for some dynamic requests. Workers Paid includes 10 million requests and
30 million CPU milliseconds per month. Static asset requests are free. The
account has a $25 usage alert, which is a notification rather than a hard
limit. Watch Worker CPU, R2 operations and storage, Hyperdrive, and any other
paid services in the Cloudflare billing dashboard after cutover.

Neon is a separate Free account. Its October 2026 allowance is 100 compute
unit hours and 1 GB of storage **per project** each month. On October 13 the
production project had used 6,519 compute seconds (1.81 CU-hours) and 32.6 MB
of storage; the acceptance project had used 9,845 compute seconds (2.74
CU-hours) and 33.2 MB; the private-writing project had used 1,899 compute
seconds (0.53 CU-hours) and no storage. These are pre-cutover figures. The
production compute is fixed at 0.25 CU and was idle when checked. The isolated
preview compute was capped at 0.25 CU on October 13; all three computes were
idle and had scale to zero enabled when checked. Neon's API value
`suspend_timeout_seconds: 0` uses the plan default idle timeout. A 0.25 CU
compute kept awake all month would consume roughly 186 CU-hours, exceeding
the Free allowance. Avoid frequent database polling and keep scale to zero
enabled. The public footer's location read uses the shared Next data cache
for three hours; an owner city save invalidates its tag. Verify the hosted
cache and fresh city update before canonical DNS moves. After cutover, inspect
each Neon project's compute and storage at least daily for the first week;
investigate if production projects toward 80 CU-hours or 800 MB. Cloudflare's
$25 alert does not cover Neon.

The production database has a tested logical backup path: on October 13 a
`pg_dump` custom archive restored successfully into temporary local
PostgreSQL 18, with all 20 public tables and 8 rows matching. The temporary
archive was deleted. Neon Free offers a six-hour point-in-time restore
window, so a retained off-site backup remains necessary for longer recovery
and before destructive schema changes.

Images is a [separate free plan](https://developers.cloudflare.com/images/pricing/)
on this account. It permits 5,000 unique transformations per month; once
exhausted, new variants fail instead of incurring automatic overage charges.
`next.config.ts` limits generated widths to twelve and allows only qualities
75 and 90. Keep static assets on the Assets binding so they do not invoke the
Worker, and check Images usage along with Worker CPU after cutover. On October
13 the Images dashboard showed 2 unique transformations in the current month.
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
images. Images Free serves existing variants but returns error 9422 for new
ones after 5,000, so this is a broken-image risk, not an automatic charge.

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
