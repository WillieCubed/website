# Deploying willie.page

Build the selected origin, deploy it to its Cloudflare Worker, then check the
revision and behavior served at that origin. Production and private preview
have different public identities and storage boundaries, so selecting a target
is part of preparing the deployment, rather than an upload option to change
at the end.

The configuration and dated observations below incorporate the October 13,
2026 hosting migration. They preserve the acceptance work still required for
protected publication, retained data, and retirement of the old Vercel projects.
Use the [setup reference](../../reference/operations/bootstrap.md) for local
workspace and account preparation.

## Where things run

### Canonical host, private preview, and redirects

The Next.js app serves the whole site. The static Cloudflare Worker that served
the homepage prototype on willie.page is retired; the homepage is now the
`/` route.

| Host                  | Role                                  | Where it is configured               |
| --------------------- | ------------------------------------- | ------------------------------------ |
| `willie.page`         | canonical origin                      | `lib/site.ts` (`site.origin`)        |
| `preview.willie.page` | private writing preview behind Access | `cloudflare.config.ts`               |
| `www.willie.page`     | 308 to the apex, path for path        | `site.legacyHosts`, `next.config.ts` |
| `williecubed.me`      | 308 to willie.page, path for path     | `site.legacyHosts`, `next.config.ts` |
| `www.williecubed.me`  | 308 to willie.page, path for path     | `site.legacyHosts`, `next.config.ts` |
| `tour.willie.page`    | 307 to `/initiatives/fall-tour-2026`  | `site.aliasHosts`, `next.config.ts`  |
| `diaries.willie.page` | 307 to `/initiatives/twd`             | `site.aliasHosts`, `next.config.ts`  |

The 308 redirects preserve older links after the move to the canonical host.
Initiative aliases use 307 redirects because their destinations can change:
`tour.willie.page` is an entry point for the current tour, while the initiative's
full URL identifies that particular trip.

### Connect the hostname to its application rule

The redirect table is code. Adding a host means one line in `lib/site.ts`
and then attaching the hostname to the hosting project so requests for it
reach the app at all. A redirect rule for a host that is not attached does
nothing.

The route redirects also send `/apps` to `/projects` with a 307 while
`/projects` is rebuilt. `/media` is a page that lists media mentions and appearances.

## Hosting: Cloudflare Workers

### Select the build and deployment mode

OpenNext packages the Next.js app for the `willie-page` Worker. The deployment
source of truth is `cloudflare.config.ts`; its `preview` mode selects the
isolated `willie-page-preview` Worker. `wrangler.config.ts` holds bundler
settings for the beta `cf` CLI, while `wrangler.jsonc` and
`wrangler.preview.jsonc` remain for OpenNext's adapter build.

Prepare the account and runtime resources below before deploying. Build with
`pnpm build:cloudflare`, deploy with
`pnpm deploy:cloudflare` (or `pnpm deploy:cloudflare:preview`), and verify
the baked commit SHA at `/api/indieweb/revision`. Do not build once and deploy
the same `.open-next` directory to both environments: the public origin and
revision are compiled into the build.

### Authenticate to the pinned account

Create the named WillieCubed profile with `pnpm exec cf auth create williecubed`
after approving its OAuth permissions. Verify that its account ID is
`18f90fa11cf0a87145be4a1517e41217` with
`pnpm exec cf auth whoami --profile williecubed`.

Set `CLOUDFLARE_PROFILE=williecubed` when running the deploy script locally.
The config pins the same account ID, so a login from another Cloudflare account
cannot silently deploy the personal site there. The `cf` CLI keeps credentials
separate from Wrangler, and `cf auth login` updates only its default profile;
adding `--profile` does not create a named-profile login.

Do not run `cf init .` here. This project was converted with `cf migrate`, and
its Durable Object exports were reviewed. Because `cf` is currently beta,
validate both modes with a dry run and hosted checks after each CLI update.

### Keep the deployment tooling path intact

The deploy scripts supply a placeholder loopback Postgres URL only to the
local Wrangler proxy that OpenNext starts while preparing a remote upload.
The deployed Workers use the Hyperdrive IDs in `cloudflare.config.ts`; the
placeholder is never a production database credential. Bare `cf deploy`
fails at that local proxy preflight when no local connection string is set.

`cf` performs deployment. Wrangler prepares the OpenNext bundle and serves as
the `cf` bundler, but cannot deploy this project's provisioned Durable Object
exports. A failed `cf` upload must fail the build rather than silently switching
tools.

## Runtime resources and secrets

### Separate public state and share private writing deliberately

Cloudflare owns DNS, Worker delivery, R2 media, cache storage, and Web
Analytics. The production Neon project remains owned in Willie's Neon
organization; Workers reach it through the production Hyperdrive binding.
Preview has its own Neon project, Hyperdrive, cache bucket, media bucket,
Durable Objects, secrets, and public origin. Build it with
`pnpm build:cloudflare:preview` before deploying with the preview config.
Local development uses a direct `POSTGRES_URL`.
The public media store is R2 and `/media/*` serves validated immutable keys.

Production and preview have distinct OAuth keys, public cache buckets, media
buckets, and public databases. They share the private writing database, private
R2 bucket, Owner access identity, and the scoped Studio publishing token.
Preserve that distinction when provisioning or checking a binding: isolated
public test data does not make the shared private writing store disposable.

### Configure secrets for the correct Worker

The deployment uses the following secret names. Set individual values with
`cf workers secrets update` for the named Worker, or supply a private
`--secrets-file` to `cf deploy`. Keep their values out of the repository and
command arguments.

- OAuth and AT Protocol: `ATPROTO_OAUTH_JWK`, `ATPROTO_OAUTH_STORAGE_KEY`,
  `ATPROTO_APP_PASSWORD`.
- Webmentions, authorization, and notifications: `WEBMENTION_SECRET`,
  `WEBMENTION_MODERATION_SECRET`, `INDIEAUTH_INTROSPECTION_SECRET`,
  `INDIEWEB_NOTIFY_SECRET`.
- Owner access: `OWNER_ACCESS_ISSUER`, `OWNER_ACCESS_AUDIENCE`,
  `OWNER_ACCESS_EMAIL`.
- Publishing: `STUDIO_GITHUB_TOKEN`.
- Music: `MUSIC_PUBLIC_DATABASE_URL`, `MUSIC_CACHE_WRITE_DATABASE_URL`,
  `MUSIC_PRIVATE_DATABASE_URL`, `MUSIC_TOKEN_ENCRYPTION_KEY`,
  `MUSIC_REFRESH_SECRET`.

The three Music database URL secrets and refresh secret belong only on the
public Worker. Preview publishes through its existing `STUDIO_HYPERDRIVE`
connection to the private Music database and needs the Music encryption key.

The GitHub token is shared by Micropub and Studio publishing and must be present
on both Workers. Scope it to Contents and Pull requests read/write on only
`WillieCubed/website`. GitHub's protected merge enforces the required checks;
the Worker does not need Checks API access.

Match `INDIEWEB_NOTIFY_SECRET_PRODUCTION` in GitHub Actions to the production
Worker's notification secret. Rotating `ATPROTO_OAUTH_STORAGE_KEY` signs existing
Standard.site subscribers out; they must authorize again. Consider that effect
before replacing an otherwise valid key during setup.

### Set public identity before building

The AT Protocol identity is configured by `NEXT_PUBLIC_ATPROTO_DID`, which
supplies the DID served by `/.well-known/atproto-did`, and
`NEXT_PUBLIC_BLUESKY_HANDLE`. Both values are inlined at build time. Set them
in every environment that builds the site before deploying; without the DID,
the route answers 404 and the site offers no Bluesky account.

`NEXT_PUBLIC_GTAG_ID` is optional. Without it, the layout emits no Google
Analytics script. This setting is separate from Cloudflare Web Analytics,
whose automatic setup is described below.

## Build connections and hosted verification

### Connect the two build targets

Cloudflare Workers Builds should connect `WillieCubed/website` to the
production Worker on `main`. Its build command is `pnpm build:cloudflare` and
deploy command is `pnpm deploy:cloudflare`. Set `PNPM_VERSION` to the
`packageManager` version in `package.json`. Connect the preview Worker with
deploy command `pnpm deploy:cloudflare:preview` and
build command `pnpm build:cloudflare:preview`. The IndieWeb notification GitHub Action polls the
canonical revision after each `main` push and invokes the production Worker
only when the exact SHA is live. Check the Cloudflare build and the GitHub
Action on a real publish; a successful build alone is not publication proof.

### Check the public revision and routes

After a hosted deployment, run the read-only route gate with the exact full
commit SHA:

```sh
pnpm exec tsx scripts/cloudflare/verify-public-routes.mts --origin https://willie.page --sha "$(git rev-parse HEAD)"
```

The command checks the public host's deployed revision, Worker binding marker, Cloudflare server,
IndieAuth issuer, public route matrix, redirects, and unauthenticated admin
response. Use `--output <private-path>` to save a receipt. Passing this gate
does not prove authenticated writes, media upload, or database usage.
The preview Worker is private: check anonymous redirects to Access on
`preview.willie.page`, direct `workers.dev` denial, and signed owner read/write
through the custom domain. The public route gate does not apply to it.

### Complete authenticated and retained-data acceptance

The three old Vercel website projects (`website`, `willie-page-preview`, and
`indieweb-acceptance`) were disconnected from Git on October 13 so a push no
longer starts three duplicate Vercel builds. Their existing deployments remain
while protected publication and the isolated IndieWeb acceptance environment
are still being verified. The preview's original Lattice encryption key was
recovered and installed on Cloudflare, but its OAuth refresh authorization
requires owner reconnection. Delete the Vercel projects only after those
acceptance paths no longer depend on them.

Owner reconnection and the remaining publishing checks are separate from the
anonymous route gate. Record their results before treating the retained
hosting projects as removable.

## Resource budgets

The following allowances and account readings were recorded during the October
2026 migration. Use them to understand the operating thresholds, then compare
fresh usage with the applicable plan before relying on a forecast. Budget
alerts notify the owner; they do not enforce the owner's spending ceiling.

### Cloudflare allowance and the spending ceiling

Workers Free's 10 ms CPU limit is too small for some dynamic requests on this
architecture. WillieCubed billing confirmed Workers Paid subscribed on October 13. Its allowance includes 10 million requests and 30 million CPU milliseconds
per month; static asset requests are free. R2 Paid and Images Stream Basic were
also listed as subscriptions. Hyperdrive queries and connection pooling have
no separate charge on Workers Paid. The SQLite Durable Objects used by the Next
cache have their own included monthly allowance: one million requests and
400,000 GB-seconds of duration.

The billing dashboard initially showed two $10 budget alerts; the owner reports
replacing these with a $25 alert. That alert cannot enforce the owner's $25
monthly ceiling. Watch Worker requests and CPU, Durable Object requests and
duration, R2 operations and storage, and Images transformations after cutover.
Pause new billable use or change the architecture before projected charges
approach the ceiling.

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

### Neon compute is a separate budget

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

### Monitor the first week and project the month

After cutover, inspect each Neon project's compute and storage at least daily
for the first week. Project the current CU-hour rate
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

### Preserve a database recovery path

The production database has a tested logical backup path: on October 13 a
`pg_dump` custom archive restored successfully into temporary local
PostgreSQL 18, with all 20 public tables and 8 rows matching. The temporary
archive was deleted. Neon Free offers a six-hour point-in-time restore
window, so a retained off-site backup remains necessary for longer recovery
and before destructive schema changes.

## Caching and incoming work

The database can be small and still exceed its Free compute allowance if
requests keep it awake. Caches reduce repeated reads, while invalidation keeps
public changes visible. Review both parts of that behavior before relying on
caching as a cost control.

### Cache public reads and invalidate changes

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
set records receipts on its first read.

### Reject invalid submissions before database work

Malformed Webmention POSTs are rejected before the database-backed rate
counter; acceptable submissions still wake Neon. A Cloudflare rate-limiting binding rejects bursts above ten acceptable
submissions per minute per client IP before reaching Postgres. The database
counter remains authoritative: Cloudflare's binding is approximate and local
to each edge location. Both counters key Cloudflare traffic by
`CF-Connecting-IP` instead of a client-supplied first `X-Forwarded-For`
address. A steady low-rate sender can still keep Neon awake; if that happens,
enforce a zone rule before the Worker or move incoming verification off the
database path.

Hosted proof of these caches, invalidation, and Webmention rejection is required
before cutover. Other authenticated operations can still wake Neon.

### Keep shared edge caching away from account responses

Do not enable Workers Caching for this whole Worker. Its default policy can
cache responses without explicit headers, including account routes, and its
default key does not distinguish the redirect hosts. Static files already use
the free Assets binding. If runtime metrics justify more caching, scope it to
public feed or media paths, use a host-aware key, and verify a hosted cache
hit and invalidation before relying on it for cost control.

Do not send authenticated or mutable responses through a shared edge cache to
reduce a bill.

### Preserve the public-fetch boundary

IndieWeb's public URL fetch uses a connection-time DNS guard in Node.js. In
Workers, `dns.lookup` is unavailable; the URL guard rejects private IP
literals and localhost names, while Cloudflare's public-only fetch proxy
enforces the destination boundary. Keep the `global_fetch_strictly_public`
flag on both Workers so same-zone fetches also go through the public front
door. A hosted Webmention fetch is part of preview acceptance.

## Images and analytics

### Confirm the transformation tier and recorded usage

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

### Bound the variants the site can request

Remote YouTube posters bypass optimization, and there is no remote image
allowlist in the Next.js optimizer. Only local site images use the Images
binding; this prevents arbitrary remote thumbnail URLs from consuming unique
transformations.

At the current 12 widths and 2 qualities, one original image can create up to
24 variants; review this limit as content grows. There were 112 raster files
under `public/` on October 13, so even if every
one were requested in all 24 allowed width/quality combinations, those files
would use at most 2,688 monthly unique transformations. R2 uploads sent through
the optimizer can add variants; remote YouTube posters bypass it. The dashboard,
rather than this local-file bound, records actual account usage. If the month approaches 4,000 transformations, reduce
new variants or make an explicit Images plan decision before publishing more
images. Depending on the account's Images tier, exceeding 5,000 either risks
new-image failures or paid overage; neither should be the default cost plan.

### Check analytics after the domain move

Cloudflare Web Analytics already has automatic setup enabled for `willie.page`
in the WillieCubed account and was recording visits before cutover. It does not
need a new application script. Verify it continues to receive visits after the
custom domain moves to the Worker.

## Domain routing and post-deploy acceptance

### Preserve the legacy host configuration

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

### Check the current custom domains

The production Worker now owns Custom Domains for `willie.page`,
`www.willie.page`, `tour.willie.page`, and `diaries.willie.page`. The private
preview Worker owns `preview.willie.page`; its old Vercel CNAME was replaced
by a Worker-managed DNS record. Keep `workers_dev` enabled for diagnostics.
After each production deploy, check the canonical homepage, feeds, search,
image optimization, social images, IndieAuth, media delivery, Webmention
writes, and host redirects. Check Cloudflare logs and billing, then retire
Vercel projects only after protected publishing and retained data pass.

## Patched dependencies

### Next image request isolation

The Next patch addresses image requests that can leave later visitors waiting
indefinitely. When optimizing a local image, `fetchInternalImage` uses a mock
request. Reusing the visitor's socket lets a disconnect leave that mock response
unfinished; later requests for the same size and quality then wait on the
in-flight optimization until the server restarts.

`patches/next@16.3.8.patch`, applied through `patchedDependencies` in
`pnpm-workspace.yaml`, removes `socket: _req.socket`. The mock request receives
its own placeholder socket instead. The reproduction came from CI's “glass
previews retain detail at 1x” check, which hung with three icons pending. On
local `next start`, aborting cold image requests wedged 15 of 20 keys before
the patch and none afterward. That observation covers the local server used
by the Playwright smoke run. The historical Vercel configuration used its
separate service for `/_next/image`; the Cloudflare Images path is described
in the resource section above.

Next 16.3.8 still contains the original call. On an upgrade:

1. Inspect `fetchInternalImage` for `socket: _req.socket`.
2. If it remains, regenerate the patch with `pnpm patch next@<version>`, using
   the version selected for the upgrade.
3. If it is gone, remove the patch.

`pnpm install` fails when a patch no longer applies, making a forgotten patch
visible during installation. Keep the aborted-request reproduction in mind
when evaluating whether an upstream change resolves the original failure.

### Frontmatter YAML engine

The gray-matter override replaces js-yaml 3 with js-yaml 4, removing its
`argparse` and `sprintf-js` dependency chain. The accompanying
`patches/gray-matter@4.0.3.patch` adapts the YAML engine's `safeLoad` and
`safeDump` calls to `load` and `dump`. Keep the patch paired with the
`gray-matter>js-yaml` override so the engine and its caller agree.

js-yaml 4 uses the same safe default schema; no JavaScript YAML types are
enabled. Remove both the patch and override when gray-matter supports js-yaml
4 upstream.

### Scoped overrides and the recorded audit

The typography plugin's scoped selector-parser override selects 7.1.6 until
the plugin updates that dependency. A global sharp override keeps Next's
optional image dependency on the patched 0.35.5.

The development-only Next ESLint plugin depends on braces 3.0.3 through
fast-glob. As of October 10, 2026, GHSA-vfj7-8cjw-p6xm had no published fix.
The plugin reads repository-controlled root-directory patterns; the site does
not expose that parser to visitors. Production dependency audits passed in
the recorded assessment, while a full audit reported the upstream advisory.
Run the current audit when changing the dependency tree; the dated assessment
does not establish the result for a later installation.

## Open questions

The site defaults to `hello@willie.page` and `projects@willie.page`, configured
through `NEXT_PUBLIC_EMAIL_HELLO` and `NEXT_PUBLIC_EMAIL_PROJECTS` in
`site.emails` (`lib/site.ts`). Receiving mail at those addresses requires
Cloudflare Email Routing on the zone. A rendered `mailto:` link establishes
only the address the visitor can use; verify routing before claiming delivery
works. Legacy web-host redirects are a separate HTTP configuration.
