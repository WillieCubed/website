# Protocol easter eggs

This page is for whoever changes one of the site's small protocol routes,
Willie or an agent. Each one speaks a real protocol, not a copy of it. When you
add or remove one, update the table and rerun `pnpm test`.

Every handler is a Next route handler on Web-standard `Request` and `Response`,
so it moves with the site if the host changes (see [deploy.md](./deploy.md)).
The logic lives in `lib/` so the tests can call it without a server, and the
route file only forwards the request.

## Routes

| Route                       | Protocol                                                                                             | Notes                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/coffee`                   | HTCPCP, [RFC 2324](https://www.rfc-editor.org/rfc/rfc2324)                                           | Every `GET` or `POST` gets a real 418, because this server is a teapot. The footer tagline "418 I'm a teapot." links here.                                                                              |
| `/tea`                      | HTCPCP-TEA, [RFC 7168](https://www.rfc-editor.org/rfc/rfc7168)                                       | `POST` a `message/teapot` body of `start` or `stop`. `Accept-Additions` allows the RFC 2324 milk types and answers 406 otherwise.                                                                       |
| prose links                 | none; links to `/coffee` and `/tea`                                                                  | A standalone "coffee" or "tea" in writing and initiative MDX becomes a quiet plain `<a>` (`lib/writings/remark-brews.ts`). JSX copy uses `withBrewLinks`.                                               |
| `/whoami`                   | none; echoes the request                                                                             | Plain text for `curl`, HTML for browsers, never cached or stored. See the host note below.                                                                                                              |
| every path                  | `X-Clacks-Overhead: GNU Terry Pratchett`                                                             | Defined in `lib/response-headers.ts`, served by `headers()` in `next.config.ts`.                                                                                                                        |
| every page                  | `Link` header, [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288)                                    | The head's Webmention, Micropub, IndieAuth, and WebSub hub links, for clients that read headers. See the Link header note below.                                                                        |
| every path                  | Security headers                                                                                     | `nosniff`, a pinned referrer policy, a permissions policy, and an opener policy on pages. See the security headers note below.                                                                          |
| `/.well-known/security.txt` | [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)                                                   | `Expires` is required and must stay under a year out. A unit test fails 30 days before it lapses; renew `SECURITY_TXT_EXPIRES`.                                                                         |
| `/opensearch.xml`           | [OpenSearch](https://github.com/dewitt/opensearch/blob/master/opensearch-1-1-draft-6.md) description | Lets a browser add the site as a search engine. Queries go to `/search?q=`. Root layout advertises it with `<link rel="search">`.                                                                       |
| `/api/mcp`                  | [Model Context Protocol](https://modelcontextprotocol.io), Streamable HTTP                           | Read-only and unauthenticated: `get_profile`, `list_writings`, `get_writing`, `search_writings`, `list_initiatives`, and `brew_coffee`, which answers with a 418 tool error. See the MCP section below. |
| `/llms.txt`                 | [llmstxt.org](https://llmstxt.org)                                                                   | An H1, a summary, and `- [name](url): notes` lists of the published writings, feeds, and protocol endpoints. Drafts never appear.                                                                       |
| `/humans.txt`               | [humanstxt.org](https://humanstxt.org)                                                               | Who made the site and with what, from `lib/humans-txt.ts`. See the humans.txt note below.                                                                                                               |
| every page                  | [Fragmention](https://indieweb.org/fragmention)                                                      | A URL ending in `##some+words` scrolls to and highlights the first place those words appear. See the fragmentions note below.                                                                           |
| every page                  | [Speculation rules](https://developer.mozilla.org/docs/Web/API/Speculation_Rules_API)                | Prefetches in-site pages on hover. See the speculation rules note below.                                                                                                                                |

## humans.txt

The TEAM block names Willie, the canonical origin, and the hello address
from `site.emails`. In the SITE block, `Last update` is the day the
deployment was built, in the site's time zone: `next.config.ts` sets
`SITE_BUILT_AT` in `env`, and Next inlines it into the bundle while
building, so the prerendered file keeps the build's date. The Components
line names packages from `package.json`, and
`tests/unit/humans-txt.test.mts` fails when one of them leaves it. Edit
the Standards line when a protocol comes or goes.

The head links the file as a second `rel="author"` with
`type="text/plain"`, after the link to the homepage. The IndieWeb
authorship algorithm follows the first `rel="author"` link to find the
author's h-card, so the homepage has to stay first.

## The Link header

Webmention, Micropub, IndieAuth, and WebSub clients may discover endpoints
from an HTTP `Link` header without parsing the page, so every page response
carries the same links the head does. Both render `ENDPOINT_DISCOVERY_LINKS`
in `lib/indieweb/discovery-links.ts`, with the same relative paths, so a
preview deployment advertises its own endpoints. Next adds a second `Link`
header of its own for font and image preloads; HTTP treats the two as one
list.

Only pages get it, because a feed or a JSON endpoint that claims a
Webmention endpoint misleads a sender. `PAGE_SOURCES` in
`lib/response-headers.ts` names the page routes, and
`tests/unit/response-headers.test.mts` walks `app/` and fails when a new
page is missing from it or a route handler matches it. The files on the
path from `next.config.ts` import each other by relative path: Next's config
loader resolves `@/` against the wrong folder for a file under `lib/`, and
the build fails with "Cannot find module".

## Security headers

`lib/response-headers.ts` sends four headers that cost nothing, because the
site never does what they forbid:

| Header                       | Value                                                                              | Where                                        |
| ---------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| `X-Content-Type-Options`     | `nosniff`                                                                          | every path                                   |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                                                  | every path outside `/indieauth/`             |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()` | every path                                   |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups`                                                         | pages only (`PAGE_SOURCES`), never IndieAuth |

The referrer policy is already every browser's default. Pinning it keeps a
host or a future default from loosening it. The IndieAuth consent page sends
the stricter `no-referrer` itself, and a header from `next.config.ts`
replaces the one a route handler sets, so the rule skips `/indieauth/`;
`tests/e2e/routes.spec.mts` checks that the consent page keeps its own.

The permissions policy also binds the YouTube, Spotify, and SoundCloud
embeds, none of which asks for those features. Chromium still recognises
`interest-cohort` and logs nothing for it, so the header keeps FLoC's old
switch beside its successor, `browsing-topics`.

The opener policy stays off the `/indieauth/` routes. A Micropub client
may open sign-in in a popup and, once the popup lands back on its own
redirect page, read `window.opener` to hand over the code. The policy on
any page in that chain would cut the popup loose. The site's own popups
(the palette's new-tab results and the share links) open with `noopener`
or through `navigator.share` and need no opener either way.

There is no `Content-Security-Policy`. A `script-src` without
`'unsafe-inline'` needs a nonce on every inline script: the theme script in
the head, Next's inline RSC payload, and the Google tag snippet. Next adds
nonces only while rendering a request, which turns off the static
prerendering and Partial Prerendering the site runs on
(`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`).
Next's experimental SRI mode covers script files, not those inline
scripts, and a policy that allows `'unsafe-inline'` blocks almost nothing.
The consent page, which renders no scripts, carries a strict policy of its
own.

## Fragmentions

A link that ends in `##some+words` ([fragmention](https://indieweb.org/fragmention))
points at the first place those words appear on the page.
`components/site/Fragmention.tsx`, mounted once in the root layout, reads the
hash on load, on `hashchange`, and after a client-side navigation, which Next
makes with `pushState` and so fires no `hashchange`; the Navigation API's
`navigatesuccess` covers it. The words are percent-decoded with `+` as a
space. The first visible text node inside `<main>` that holds them, ignoring
case and line breaks, is scrolled to the middle of the window and
highlighted. A screen-reader-only heading does not count as visible, so a
note's hidden title never takes the match from its text. The matching lives
in `lib/fragmention.ts` with unit tests, and `tests/e2e/fragmention.spec.mts`
checks real pages.

The highlight is a CSS Custom Highlight, styled by `::highlight(fragmention)`
in `app/globals.css`, not a `<mark>`. The effect runs before the streamed
parts of a page hydrate, and a `<mark>` inserted there made React report a
hydration mismatch (minified error #418) and render the whole `<main>` again
on the client. A highlight changes no DOM node. It takes the page's brand
scheme and never animates. A highlight cannot draw an outline, so an
underline marks its edge.

Words that cross an element boundary, such as a phrase that runs into a
link, match nothing, because the search reads one text node at a time. A
browser without the Custom Highlight API still scrolls to the words, and one
without the Navigation API follows a fragmention only on load and on
`hashchange`.

## Speculation rules

The root layout carries a `<script type="speculationrules">` built from
`lib/speculation-rules.ts`. It prefetches same-origin links at `moderate`
eagerness, which in Chromium means after about 200ms of hover on a desktop.
It skips `/api/`, the feeds and activity feeds, `/micropub`,
`/webmention` and `/webmentions`, `/indieauth/`, `/oembed`, `/coffee`,
`/tea`, `/whoami`, `/.well-known/`, any path with a file extension, and any
link with `rel~="nofollow"`, `target="_blank"`, or `download`.

It prefetches rather than prerenders because of Next's router. `SiteLink`
sends every in-site link through Next's `<Link>`, and once the page has
hydrated a click becomes a client-side navigation that fetches the
destination's RSC payload. Next already prefetches that payload as soon as
the link enters the viewport in production
(`node_modules/next/dist/docs/01-app/02-guides/prefetching.md`), and it never
activates a prerendered document. A prerender would run the whole page,
with its scripts and analytics, for a navigation Next then performs without
it. A document prefetch is one HTML request, and it serves the navigations
the router does not take: a click before the page hydrates, a visitor
without JavaScript, and a navigation Next hands to the browser.

After hydration each hovered link still costs that HTML request, which
nothing reads. If that ever shows up in bandwidth, limit the rule to the
page before hydration, for example with a `not` `selector_matches` on an
attribute a client component sets on `<html>`.
`tests/unit/speculation-rules.test.mts` checks the exclusions with
`URLPattern`, and `tests/e2e/speculation.spec.mts` reads the candidate list
Chromium reports through its DevTools Preload domain.

## In the command palette

The ⌘K palette (`lib/palette/`) runs these for visitors who never open a
terminal. Typing a whole command name and pressing Enter makes the real
request and shows the response; a partial name never matches, and the
commands are never listed. `brew`, `coffee`, and `teapot` send `POST /coffee`;
`tea` starts a pot at `/tea`; `whoami`, `clacks`, and `security` read their
routes; `mcp` copies a client config for `/api/mcp`; `llms` opens `/llms.txt`
and `humans` opens `/humans.txt`; `fortune` draws a tagline. A request that
fails shows what failed. When you add a route here, add its command to
`eggs()` in `lib/palette/commands.ts` too.

## Try them

```sh
curl -i https://willie.page/coffee
curl -i -X POST -H 'Content-Type: message/teapot' -H 'Accept-Additions: Whole-milk' -d start https://willie.page/tea
curl https://willie.page/whoami
curl https://willie.page/humans.txt
curl -I https://willie.page/ | grep -i clacks
```

## Known limits

- **`BREW` and `WHEN` never arrive.** Node's HTTP parser rejects methods it
  does not know, so `curl -X BREW` gets a 400 from the dev server before the
  app runs. RFC 2324 also allows `POST` for brewing, which is what `/tea` uses.
  Whether Vercel's edge passes `BREW` on is untested; try it on a preview
  deployment.
- **`/whoami` differs by host.** Vercel provides the address, country, region,
  city, and an edge id through headers. Cloudflare's `request.cf` adds the HTTP
  version, TLS, colo, ASN, and round-trip time. `whoamiResponse` takes that
  object as its second argument; nothing passes it until the site moves to
  Cloudflare Workers.

## MCP server

`/api/mcp` is a stateless MCP server built with `mcp-handler` in
`lib/mcp/site-server.ts`. It has no authentication because it serves only what
the site already publishes, and every tool is read-only. Point a client at
`https://willie.page/api/mcp`.

- **What it can see.** `lib/mcp/site-content.ts` connects the tools to the
  site's own loaders, which hide drafts in production. The tools test against
  plain data through the `SiteContent` interface, because the loaders only run
  inside Next. While every writing is a draft, `list_writings` and
  `search_writings` return nothing in production, as `/writings` does, while
  `/search` still finds the static pages. In development drafts show, except in search, whose index always leaves
  them out. `get_writing` returns the MDX source, so a few JSX components such as
  `<Ref>` and `<SpotifyEmbed>` come through as text.
- **Browsers.** The route answers a CORS preflight and sends
  `Access-Control-Allow-Origin: *` (`lib/mcp/cors.ts`), so a browser-hosted MCP
  client on another origin can call it. `robots.txt` allows `/api/mcp` under the
  otherwise disallowed `/api/`, matching the link in `/llms.txt`.
- **No rate limit in code.** A per-process limiter does nothing on serverless.
  If traffic ever needs limiting, add a rule in the host's firewall for
  `/api/mcp`.
- **Listing it.** The official MCP Registry is in preview. A domain-based name
  is reverse DNS, so this site would publish as `page.willie/...`, proved with a
  DNS TXT record (`v=MCPv1; k=ed25519; p=<public key>`) or a
  `/.well-known/mcp-registry-auth` file. Nothing is published there yet.
