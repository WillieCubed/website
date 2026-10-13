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

OpenNext packages the Next.js app for the `willie-page` Worker. The source of
truth is `wrangler.jsonc`; `wrangler.preview.jsonc` deploys an isolated
`willie-page-preview` Worker. Build with `pnpm build:cloudflare`, deploy with
`pnpm exec wrangler deploy` (or `--config wrangler.preview.jsonc`), and verify
the baked commit SHA at `/api/indieweb/revision`. Do not build once and deploy
the same `.open-next` directory to both environments: the public origin and
revision are compiled into the build.

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
`ATPROTO_APP_PASSWORD`. Set them with `wrangler secret put` or a private JSON
file and `wrangler secret bulk`; never put values in the repository or command
arguments. `INDIEWEB_NOTIFY_SECRET_PRODUCTION` in GitHub Actions must match the
production Worker secret. Rotating the OAuth storage key signs existing
Standard.site subscribers out; they must authorize again.

Cloudflare Workers Builds should connect `WillieCubed/website` to the
production Worker on `main`. Its build command is `pnpm build:cloudflare` and
deploy command is `pnpm exec wrangler deploy`. Set `PNPM_VERSION` to the
`packageManager` version in `package.json`. Connect the preview Worker with
deploy command `pnpm exec wrangler deploy --config wrangler.preview.jsonc` and
build command `pnpm build:cloudflare:preview`. The IndieWeb notification GitHub Action polls the
canonical revision after each `main` push and invokes the production Worker
only when the exact SHA is live. Check the Cloudflare build and the GitHub
Action on a real publish; a successful build alone is not publication proof.

On the current Worker architecture, Workers Free's 10 ms CPU limit is too
small for some dynamic requests. Workers Paid includes 10 million requests and
30 million CPU milliseconds per month. Static asset requests are free. The
account has a $25 usage alert, which is a notification rather than a hard
limit. Watch Worker CPU, R2 operations and storage, Hyperdrive, and any other
paid services in the Cloudflare billing dashboard after cutover.

Images is a [separate free plan](https://developers.cloudflare.com/images/pricing/)
on this account. It permits 5,000 unique transformations per month; once
exhausted, new variants fail instead of incurring automatic overage charges.
`next.config.ts` limits generated widths to twelve and allows only qualities
75 and 90. Keep static assets on the Assets binding so they do not invoke the
Worker, and check Images usage along with Worker CPU after cutover. Do not
send authenticated or mutable responses through a shared edge cache to reduce
a bill.

To cut over a verified candidate, add Custom Domains for `willie.page`,
`www.willie.page`, `tour.willie.page`, and `diaries.willie.page` to the
production Worker. Add both `williecubed.me` hosts only after confirming that
zone is in the same account. Custom Domains replace the old Vercel DNS target
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
