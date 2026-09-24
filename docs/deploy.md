# Deploying willie.page

This page is for whoever deploys the site or changes a domain, Willie or an
agent. Read it before touching DNS, the hosting project, or the redirect
table in `next.config.ts`. When you finish a change here, run
`sh scripts/cutover-willie-page.sh` and make every check pass.

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

The same table sends two retired pages to their replacements with a 307:
`/media` goes to `/initiatives/twd` and `/apps` goes to `/projects`. They
stay temporary while `/projects` is rebuilt.

## Hosting today: Vercel

The app deploys to Vercel from the GitHub repository. Vercel-specific
dependencies are `@vercel/postgres`, `@vercel/analytics`, and
`@vercel/speed-insights`. Postgres holds webmentions and their rate limits
(`lib/indieweb/webmention-storage.ts`), outgoing webmention hashes and reply
contexts, and the optional search backend (`lib/search/postgres.ts`); the two
webmention scripts under `scripts/` read it too. Nothing else assumes Vercel.

DNS for both zones is at Cloudflare. Records that point at Vercel must be
DNS-only (grey cloud); proxying them through Cloudflare puts two TLS
terminators in front of one origin and breaks Vercel's certificate issuance.

`scripts/cutover-willie-page.sh` walks the domain attachment and DNS steps in
order, prints each one, and verifies with `dig` and `curl` at the end.

## The Cloudflare question

Willie is considering moving the whole site to Cloudflare Workers. The code
is kept host-agnostic so that move is a spike, not a rewrite. What it would
take, as of September 2026:

| Concern       | Vercel (now)               | Cloudflare via OpenNext                                                                                                 | Cloudflare via vinext                                                                 |
| ------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Runtime       | Next 16, `cacheComponents` | Next 16 supported; PPR and `use cache` listed as supported; Node middleware (`proxy.ts`) not yet, and the site has none | A Vite reimplementation of Next; `cacheComponents`, `next/og`, `next/font` unverified |
| Postgres      | Vercel Postgres            | Hyperdrive to the same Postgres, or D1; every module that imports `@vercel/postgres` changes                            | same                                                                                  |
| Analytics     | Vercel Analytics           | Cloudflare Web Analytics beacon                                                                                         | same                                                                                  |
| Redirects     | `next.config.ts`           | same file                                                                                                               | same file, if supported                                                               |
| Social images | `next/og`                  | documented as working on workerd; verify                                                                                | unverified                                                                            |
| Deploy        | git integration            | `wrangler deploy` with `@opennextjs/cloudflare`                                                                         | `create-vinext` / `migrate-to-vinext`                                                 |

The spike, in order:

1. In a fresh worktree, run the OpenNext Cloudflare adapter's build and note
   every warning.
2. Point the modules that import `@vercel/postgres` at Hyperdrive with the
   `postgres` driver and run the webmention and search tests.
3. Render one `opengraph-image` route on workerd and compare it with the
   Vercel output.
4. Preview on a `*.workers.dev` hostname before touching DNS.

Do not start on vinext until its own skills confirm `cacheComponents` and
`next/og` support.

## Open questions

Every address on the site is on willie.page (`hello@`, `projects@`), set
by `NEXT_PUBLIC_EMAIL_HELLO` and `NEXT_PUBLIC_EMAIL_PROJECTS` with those as
defaults (`site.emails` in lib/site.ts), and williecubed.me is legacy: it
only redirects here. Mail to willie.page
needs Cloudflare Email Routing on the zone before these addresses receive
anything. `NEXT_PUBLIC_GTAG_ID` is optional; without
it the layout emits no analytics script.
