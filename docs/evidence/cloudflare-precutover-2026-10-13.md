# Cloudflare pre-cutover baseline — 2026-10-13

Checked at approximately 11:57 UTC. This is a baseline for the later
production cutover, not proof that the canonical domain has moved.

| Public route                                            | `willie.page` | Production Worker | Preview Worker |
| ------------------------------------------------------- | ------------- | ----------------- | -------------- |
| `/`, `/status`, `/writings`                             | 200           | 200               | 200            |
| `/feed.xml`, `/api/status`                              | 200           | 200               | 200            |
| `/whoami`, `/robots.txt`, `/sitemap.xml`                | 200           | 200               | 200            |
| `/micropub`, `/webmention`                              | 200           | 200               | 200            |
| `/oauth-client-metadata.json`, `/api/indieweb/revision` | 200           | 200               | 200            |

The canonical responses carried `server: Vercel`; both Worker origins carried
`server: cloudflare`. `/api/indieweb/revision` reported these exact SHAs:

- Canonical Vercel: `96d17e40a94a68e7dc31654a43c163e98b8e651a`
- Production Worker: `1a0c9a8444f6104af17b91fd5f8325894198e562`
- Preview Worker: `e4d92eb0324a4eaa00b51656be39c0f9f97ec134`

Unauthenticated GET requests to `/api/admin/status` on both Worker origins
returned JSON with only the `configured` key. The admin page returned 200,
but that response status alone does not prove the absence of protected HTML.
No production owner sign-in was attempted.

The production and preview Worker secret inventories each listed the eight
previously installed secrets. Neither listed `MICROPUB_GITHUB_TOKEN` nor
`ATPROTO_APP_PASSWORD`. WillieCubed `cf auth whoami --profile williecubed`
reported `authenticated: false`; the default `cf` profile belongs to another
Cloudflare account and must not be used for this deployment. The GitHub App
installation page still awaited authorization for `WillieCubed/website`.

The branch has a local `/whoami` fix at `6bab8d3` that is not in either
hosted Worker. Its six focused unit tests, lint, typecheck, OpenNext build,
`cf deploy --dry-run`, and local Worker preview passed. The local Worker
reported Cloudflare city, colo, HTTP, TLS, ASN, and RTT fields, and ignored a
spoofed `x-vercel-ip-city` header.

Before changing DNS, deploy the same reviewed branch through the WillieCubed
`cf` profile, verify the exact hosted revision and owner publishing flows,
then repeat this route matrix and compare retained production data counts.

Direct Worker URL audit later on October 13: unauthenticated GETs to both
production and preview Worker origins returned only `configured` from
`/api/admin/status`; `/admin/status` rendered its sign-in UI, while
`/indieauth/userinfo` returned 401 and `/indieauth/consent` returned 400
without a valid request. The known draft writing
`/writings/testing-independent-publishing` and its
`/api/studio-publication/testing-independent-publishing` proof route both
returned 404 on both Worker origins. This covers those owner and draft paths
on the already deployed Workers. Repeat the check at the exact release SHA
before concluding that the direct Worker URLs are safe after cutover.
