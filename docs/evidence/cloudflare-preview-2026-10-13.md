# Cloudflare preview acceptance — 2026-10-13

Account: WillieCubed (`18f90fa11cf0a87145be4a1517e41217`). The production
and preview Workers have separate Hyperdrive connections, R2 media/cache
buckets, Durable Objects, and secrets. `willie.page` and `williecubed.me`
are active zones in this account. The canonical `willie.page` hosts still
point to Vercel; the legacy `williecubed.me` redirect hosts moved to the
production Worker on October 13.

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
The production build and `cf` dry run passed at the same Git revision. The
production Worker still lacks `MICROPUB_GITHUB_TOKEN` and
`ATPROTO_APP_PASSWORD`; Vercel marks those values as non-readable Secrets, so
they require replacement before a production deployment and DNS cutover.

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

Cutover still requires owner-created GitHub and Bluesky credentials, production
TOTP enrollment, the GitHub App build connection, exact-revision production
redeployment, custom domains, and public route/write checks. This preview
receipt is not production acceptance.

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
