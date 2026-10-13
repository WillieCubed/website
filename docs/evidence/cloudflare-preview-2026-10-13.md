# Cloudflare preview acceptance — 2026-10-13

Account: WillieCubed (`18f90fa11cf0a87145be4a1517e41217`). The production
and preview Workers have separate Hyperdrive connections, R2 media/cache
buckets, Durable Objects, and secrets. `willie.page` and `williecubed.me`
are active zones in this account. At the start of these checks, the canonical
`willie.page` hosts pointed to Vercel; the legacy `williecubed.me` redirect
hosts moved to the production Worker on October 13. The canonical cutover is
recorded below.

Before canonical cutover, `willie.page` returned `server: Vercel` and
revision `96d17e40a94a68e7dc31654a43c163e98b8e651a`.
GET `/`, `/status`, `/api/status`, `/writings/feed.xml`, `/micropub`, and
`/api/indieweb/revision` returned 200; `/rss.xml` returned 308 to
`/feed.xml`. Current `content/`, `public/`, `lib/`, and `app/` files contain no
`blob.vercel-storage.com` reference. The Vercel public Blob store separately
reported zero objects. A fresh production `pg_dump --data-only` inspected in
memory on October 13 also found zero `blob.vercel-storage.com` references;
neither the dump nor its connection string was written to disk.

Preview: `https://willie-page-preview.willieechalmers-18f.workers.dev`.
The Worker advertises its own preview origin in IndieAuth metadata, feeds, and
links. GET checks returned 200 for `/`, `/status`, `/search`, `/api/status`,
`/api/search?q=Willie`, RSS/Atom/JSON feeds, IndieAuth metadata,
AT Protocol DID, OAuth client metadata, writing and initiative social images,
`/robots.txt`, `/sitemap.xml`, `/micropub`, and `/webmention`.
`/rss.xml` returned 308 to the preview feed. An absent R2 media key and an
unpublished writing returned 404. GET `/micropub/media` returned 405, as it
is a POST-only endpoint.

On October 13, the exact migration head `874f78190552d4fe41b8f772643e828196a207cd`
was deployed to this isolated preview as Worker version
`c115b35a-ef6b-496e-8b3e-afce2ea1ff42`. The hosted release gate checked the
revision's `cloudflare-workers` runtime marker and all public routes and passed.
A new isolated preview TOTP secret then passed the live authorization-code,
UserInfo, 230,008-byte R2 media upload/delivery, token revocation, and R2
cleanup gate. The temporary local secret file was removed after the test.
The preview's GitHub and Bluesky publishing secrets are deliberately disabled;
no outbound publishing was claimed from this receipt.

The new `cf` CLI was authorized for the WillieCubed account with 24 selected
permissions, down from its default 474. It passed a production dry run but
twice failed the preview upload while Cloudflare's Hyperdrive binding service
returned `sqc-config` HTTP 503 (`10021`). Deploying the same built artifact
with the repository's Wrangler preview configuration succeeded. This is a
deployment-tool/provider failure, not evidence that the Worker runtime failed.
The production build and `cf` dry run passed at the same Git revision. At that
point, the production Worker lacked `MICROPUB_GITHUB_TOKEN` and
`ATPROTO_APP_PASSWORD`; Vercel marked those values as non-readable Secrets, so
the owner later created replacements before production deployment.

Cloudflare Workers Builds was connected on October 13 to the GitHub App's
`WillieCubed/website` repository for the `willie-page-preview` Worker. The
production branch for this isolated Worker is `codex/cloudflare-migration`;
builds for other branches are disabled. The build runs
`pnpm build:cloudflare:preview`, then `pnpm deploy:cloudflare:preview`, with
`PNPM_VERSION=11.5.1` and build caching enabled. Cloudflare created the
approved account-scoped `WillieCubed website Workers Builds` API token. A
repository push after this connection exercised the first hosted Git build.
Build `b8d8b439-9859-42be-8c2a-190a57137b6d` installed with pnpm 11.5.1,
built the OpenNext Worker, and deployed version
`60cb384e-d6f1-41de-ac77-7d982d6429ed` from exact commit
`02285d611a92921c533d4c6c9ed129204a730fc3`. The hosted public route
matrix passed after that version became active. GitHub's Cloudflare check,
content check, CI, and smoke check passed; the old Vercel checks failed because
Vercel rate-limited deployments for 24 hours.

A production build of that commit succeeded locally. Its deploy stopped before
activating a new production Worker version: Cloudflare rejected the missing
required production secrets `MICROPUB_GITHUB_TOKEN` and
`ATPROTO_APP_PASSWORD`. The owner must create and enter replacements directly
before a production candidate can be deployed.

At `4918e2e3e6a6ef65108ab7289561ae51b0c396ce`, the preview build and
`pnpm deploy:cloudflare:preview` completed through `cf`, producing Worker
version `924dd895-8522-432f-bddb-4d0f6468a42d`. The hosted route gate passed
again with that exact SHA. A GET of the preview IndieAuth consent page using
IndieAuth.com's public `client_id` and listed redirect URI rendered the
fetched client name `IndieAuth.com`. This exercises the outbound metadata
fetch on the hosted Worker; the Cloudflare runtime skips Node's unsupported
`dns.lookup` and uses Workers' public-network `fetch` with URL and redirect
guards. No authorization was approved by that GET.

Hosted write checks:

- A Webmention rate-limit write reached the isolated Neon database through
  Hyperdrive and returned 400 for an invalid request without hanging. The
  exact synthetic rate-limit row was removed.
- An isolated IndieAuth S256/TOTP consent returned 303, authorization-code
  redemption returned 200, and UserInfo returned 200. An authenticated media
  POST returned 201. The R2 delivery returned 200, `image/jpeg`, and exactly
  the 230,008 original bytes. Both issued tokens were revoked, the test R2
  object was deleted, and its URL returned 404 afterward.
- A separate direct R2 object smoke returned byte-identical media with
  immutable cache and `nosniff` headers, then its object was deleted.
- After replacing the unsupported Workers `dns.lookup` preflight, a hosted
  Webmention received an external source at `https://httpbingo.org/status/404`
  (with a unique query marker) and returned 202. The isolated Neon row was
  subsequently marked deleted by the asynchronous verifier, which only
  happens after fetching the source's real 404 response. The synthetic row
  was deleted. This proves the Worker can fetch a public hostname through
  Cloudflare's outbound proxy; the earlier invalid-source smoke could not.

`pnpm check` passed 892 unit tests, lint, typecheck, and a normal Next.js
build before the later writing cache and maintainer-doc edits. A subsequent
`pnpm typecheck`, `pnpm lint`, and `pnpm build` passed; the writing detail
build output now reports one-minute revalidation instead of the layout's
15-minute default. Run the final suite again after the release commit.

At the time of this preview receipt, cutover still required owner-created
GitHub and Bluesky credentials, production TOTP sign-in, production Workers
Builds, exact-revision deployment, custom domains, and public route/write
checks. The later production checks are recorded below.

Legacy-host cutover on October 13: production Worker version
`4c85f2d2-914f-4d84-872d-e769f6be431e` was built from commit `c52be2f`.
`www.williecubed.me` uses a Worker Custom Domain. The apex uses the
`williecubed.me/*` Worker route and a proxied `AAAA 100::` DNS placeholder.
Cloudflare's initial apex Custom Domain had created a managed DNS row but no
public A or AAAA answer; detaching that domain and publishing the proxied
placeholder resolved it. Authoritative Cloudflare DNS and public `1.1.1.1`
then returned Cloudflare edge addresses. Both hosts returned `308` for
`/test/path?source=codex` with a `Location` of
`https://willie.page/test/path?source=codex`. The local system resolver still
held a negative cache entry immediately after the change, so the apex HTTPS
test used the authoritative edge address with `curl --resolve`. All three
existing mail MX records and the AT Protocol identity TXT record were still
present. The old zone-wide `https://www.*` Redirect Rule was disabled after
it incorrectly generated `/williecubed.me/...` in the destination path.

Production Postgres recovery check on October 13: `pg_dump` from the
independently owned Neon production project produced a 45,713-byte custom
archive. `pg_restore --exit-on-error` loaded it into a fresh, temporary local
PostgreSQL 18 database. All 20 public tables and their row counts matched the
live source (8 rows total, 0 differing tables). The local database, dump, and
connection string were removed when the check ended. This verifies a usable
logical backup path; it is not a retained off-site backup or a point-in-time
recovery test.

Free-tier pressure and status freshness check on October 13: the Neon Free
production project used 1.81 of 100 monthly CU-hours and 32.6 MB of its 1 GB
storage allowance. Its 0.25 CU compute was idle during the check; continuously
running it for a 31-day month would consume about 186 CU-hours. The footer's
location reader was missing its documented cache and the admin invalidation
was a no-op. On the old preview Worker, two `/api/status` requests 75 seconds
apart caused two origin `status_location` reads, measured with
`pg_stat_statements` in the isolated preview Neon database. After adding a
three-hour Next data cache, the same requests caused one origin read. A
separate authenticated preview owner save initially returned the old city
because Hyperdrive had cached its SELECT. Making this specific query
uncacheable with a volatile PostgreSQL timestamp fixed that: the public API
returned Henderson immediately after a save and Las Vegas immediately after
the restore save. Preview version `a183addf-b715-4ff8-aa7b-2918e798df04`
served the passing check. The temporary TOTP test secret was removed from the
local machine; the preview Worker retains its isolated test secret. The
synthetic status row and temporary `pg_stat_statements` extension were removed
from the isolated preview database after verification.

Cloudflare dashboard check on October 13: Web Analytics for `willie.page` had
automatic setup and showed 7 visits in the preceding 24 hours. The account's
Images Transformations dashboard showed 2 unique image transformations for
the current month. The production candidate Worker had 59 invocations, 6
asset requests, and 0 Worker errors in the preceding 24 hours. These counts
are from pre-cutover testing; they do not predict usage after public DNS moves.

Local cost-cache acceptance on October 13, after the later Webmention snapshot
change: a disposable PostgreSQL 18 database and local OpenNext Worker with
simulated R2 served two separate `/webmentions` requests for an approved reply.
Both returned 200 and the reply. PostgreSQL statement logging showed one
approved-mention snapshot SELECT before the second request and still one
afterward. A bearer-authenticated moderation POST then rejected the reply
and returned 200. The next public GET hid it, and the origin SELECT count rose
to two. This verifies local R2 snapshot reuse and post-moderation invalidation
across Worker requests; it does not prove hosted R2 or Hyperdrive behavior.
The temporary database and R2 state were deleted after the check.

At branch head `5940eeb`, a separate `pnpm build:cloudflare:preview` completed,
followed by `cf deploy --mode preview --dry-run --profile williecubed`. The dry
run named the preview Worker, preview Hyperdrive, preview cache and media R2
buckets, and preview Durable Objects. A local Worker started from that bundle
returned `5940eeb6a4b863d2cede6046dccbf568dbdf5a92` from
`/api/indieweb/revision`; its IndieAuth server metadata advertised
`https://willie-page-preview.willieechalmers-18f.workers.dev/` as issuer and
preview-host authorization and token endpoints. Local OAuth client metadata
reported sign-in unavailable because no OAuth secrets were supplied to the
disposable local Worker. This verifies the preview build configuration and
packaging, not a hosted deployment or owner sign-in.

## Production cutover, October 13

The owner saved `MICROPUB_GITHUB_TOKEN` and `ATPROTO_APP_PASSWORD` directly on
the production `willie-page` Worker. `wrangler secret list` confirmed both
names and `secret_text` types after deployment; their values were neither read
nor copied. The production OpenNext build from exact commit
`565737eea9784e6054adf5d5215b1986dd2ff08b` succeeded. Cloudflare
activated Worker version `e7ed9f69-9ba0-4cd2-9abd-17432a24859c` with
Custom Domains for `willie.page`, `www.willie.page`, `tour.willie.page`, and
`diaries.willie.page`. The existing `williecubed.me/*` Worker route and
`www.williecubed.me` Custom Domain remained active.

Cloudflare rejected the first domain attach because four Vercel CNAME records
occupied those names. Removing those exact CNAME records and repeating the
deployment succeeded. The Cloudflare DNS API then returned four read-only,
proxied Worker-managed AAAA records. Fresh Cloudflare and Google DNS-over-HTTPS
queries resolved the apex to Cloudflare edge addresses; this Mac's local DNS
resolver still returned cached Vercel addresses immediately after cutover.
The three `willie.page` MX records remained on Cloudflare Email Routing.

The full hosted public route gate passed on the production diagnostic Worker
URL at the exact SHA. Direct Cloudflare edge HTTPS checks for the canonical
host returned 200 for `/`, `/status`, `/search`, `/api/status`, search API,
RSS/Atom/JSON feeds, IndieAuth metadata, OAuth client metadata, `/micropub`,
`/webmention`, social images, and image optimization; an absent writing
returned 404. `www.willie.page` returned the expected path-preserving 308;
`tour.willie.page` and `diaries.willie.page` returned their expected 307
initiative redirects. The two `williecubed.me` redirects continued to return
path-preserving 308 responses.

The production GitHub and Bluesky secret values have not been exercised by a
real publish. Owner sign-in now uses one Cloudflare Access application; the
website TOTP path was removed, and the owner confirmed the live status editor
appeared after Access sign-in. Protected publishing remains an acceptance gate
before Vercel retirement.

## Private preview cutover, October 13

The preview Worker received the `7e77b3c38fa2d99c4aad876f4a0c6354ecdc365c`
source build with private Studio bindings. Its direct `workers.dev` address
returned 401 to anonymous requests for `/`, `/studio`,
`/api/studio/documents`, and the revision endpoint. `cf deploy` initially
rejected remote configuration drift, so one local upload temporarily disabled
its strict comparison; the installed CLI file was restored immediately. The
next ordinary `cf deploy --mode preview` succeeded with strict comparison
enabled. Wrangler's separate deploy path cannot express the provisioned
Durable Object exports and is no longer a fallback.

Cloudflare refused to attach `preview.willie.page` while its proxied Vercel
CNAME existed. The exact CNAME was removed and `cf deploy` attached the Worker
custom domain, version `26a4659b-d554-4f1b-8f45-82558c8d7b2a`. The DNS API
then showed a Worker-managed, read-only AAAA record. A subsequent ordinary
deploy created version `538025a0-595c-4379-a58e-c328c83a217b`. Anonymous
requests to `/studio`, `/api/studio/documents`, static assets, and revision
metadata on the custom hostname all redirected to the existing Access policy.
In a signed Chrome session, the Studio loaded the five retained drafts.

A new scratch draft accepted text, reported all changes saved, and returned
the same text after a full page reload. The scratch document was soft-deleted
by exact ID and body match with the approved Neon CLI; the private library
again showed only the five original drafts. Preview still needs Lattice
reconnection and a successful GitHub publication. The owner saved
`STUDIO_GITHUB_TOKEN` on both Workers; `cf workers secrets list` confirmed its
name on production without exposing its value.

The next preview Git build for `91c3d9f` passed after its remote configuration
was reconciled and the invalid Wrangler fallback was removed. The obsolete
`INDIEAUTH_TOTP_SECRET`, `MICROPUB_GITHUB_TOKEN`, and `SEARCH_REINDEX_SECRET`
were deleted from the preview Worker. The current private library still loads
the five retained drafts after the secret cleanup. Workers Metrics for the
preceding 24 hours reported 419 invocations, 62 asset requests, median CPU
103 ms, and 90th-percentile CPU 459 ms. Seven CPU-limit errors belonged to
earlier Free-tier Worker versions; the current hosted preview owner flow
passed on Workers Paid. These testing-heavy preview metrics are not a
production cost forecast.

## Retained widget on the Cloudflare Worker

After private DNS cutover, the saved October 11 ToggleWidget note showed the
fallback instead of the interactive component. Wrangler tail identified two
successive runtime failures: a read from nonexistent
`/bundle/.studio/browser-runtime.js`, then the bundled native esbuild API's
inability to locate and run its executable inside Workers. The final compiler
imports the prebuilt React browser runtime as a static module and transforms
validated TSX with a JavaScript-only compiler. It rejects non-React, dynamic,
and CommonJS imports before approval. The native esbuild dependency now runs
only at build time.

The new preview Worker version `e42a40b0-6fff-495e-b7c8-2bb73e336639`
uploaded at 41,716.77 KiB uncompressed. A signed owner Chrome session opened
the retained private note on `preview.willie.page`; its ToggleWidget rendered
inside the nested opaque sandbox. Clicking the displayed Toggle control
changed its checkbox from unchecked to checked. The focused local browser
sandbox test also passed interactive mounting and blocked external script,
fetch, image, and navigation attempts. Fresh personal-runtime generation,
proposal approval, and GitHub publication remain separate hosted acceptance
checks.

## Recovered encryption key and secret cleanup

Later on October 13, the Vercel CLI exported the preview production environment
to a mode-0600 temporary file. Its `STUDIO_TOKEN_ENCRYPTION_KEY` decrypted both
retained `studio_connections` rows (`lattice` and `lattice-runtime`) without
printing their contents. `cf workers secrets bulk` installed that key on
`willie-page-preview`; Cloudflare deployed version
`dc1e2d09-39fb-4ae5-a775-efdc39c6854a` at 100%. The temporary export and
secret patch were removed.

The hosted Studio still reported that its private writing service was
unavailable when loading devices. A local read of the same retained connection
using the recovered key reached Lattice, which rejected the saved refresh
authorization. This narrows the remaining generation blocker to a fresh owner
Lattice sign-in and a hosted device check. Chrome blocked an attempted visit to
the preview's connect route with `ERR_BLOCKED_BY_CLIENT`; no OAuth grant was
completed in this check.

The private test draft titled "Temporary Cloudflare publication check" was
soft-deleted by exact document ID, title, and body marker in private Postgres.
The three unused production Worker secrets `INDIEAUTH_TOTP_SECRET`,
`MICROPUB_GITHUB_TOKEN`, and `SEARCH_REINDEX_SECRET` were removed in one `cf`
bulk patch; `STUDIO_GITHUB_TOKEN` remains. Cloudflare deployed production
version `0c14e6c5-03ba-4420-9d4b-955f6da11e04` at 100%. The read-only
canonical route matrix passed at source SHA
`54bd1f32b0d41b7be0f5471e60cfac59723c1728` after that change. Protected
GitHub publication still needs a real approved revision and exact live proof.
