# Cloudflare preview acceptance — 2026-10-13

Account: WillieCubed (`18f90fa11cf0a87145be4a1517e41217`). The production
and preview Workers have separate Hyperdrive connections, R2 media/cache
buckets, Durable Objects, and secrets. `willie.page` and `williecubed.me`
are active zones in this account. The canonical `willie.page` hosts still
point to Vercel; the legacy `williecubed.me` redirect hosts moved to the
production Worker on October 13.

Preview: `https://willie-page-preview.willieechalmers-18f.workers.dev`.
The Worker advertises its own preview origin in IndieAuth metadata, feeds, and
links. GET checks returned 200 for `/`, `/status`, `/search`, `/api/status`,
`/api/search?q=Willie`, RSS/Atom/JSON feeds, IndieAuth metadata,
AT Protocol DID, OAuth client metadata, writing and initiative social images,
`/robots.txt`, `/sitemap.xml`, `/micropub`, and `/webmention`.
`/rss.xml` returned 308 to the preview feed. An absent R2 media key and an
unpublished writing returned 404. GET `/micropub/media` returned 405, as it
is a POST-only endpoint.

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

Cloudflare dashboard check on October 13: Web Analytics for `willie.page` had
automatic setup and showed 7 visits in the preceding 24 hours. The account's
Images Transformations dashboard showed 2 unique image transformations for
the current month. The production candidate Worker had 59 invocations, 6
asset requests, and 0 Worker errors in the preceding 24 hours. These counts
are from pre-cutover testing; they do not predict usage after public DNS moves.
