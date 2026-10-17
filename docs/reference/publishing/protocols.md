# Protocol easter eggs

`/coffee` returns a real HTTP 418 because this server is a teapot. `/tea` accepts
a brewing message, and `/whoami` reports what the request reveals about its
visitor. The jokes live in actual protocol responses, so a terminal client and
a browser can both encounter them.

The table also includes the quieter discovery routes and response headers that
make the site useful to other software. Each handler uses Web-standard `Request`
and `Response`; its logic lives in `lib/`, where tests can call it without a
server. Route files forward requests. Update this inventory and run `pnpm test`
when adding or removing one of these routes; the [deployment guide](../../guides/operations/deploy.md)
covers their hosting context.

## Routes

| Route                       | Protocol                                                                                             | Notes                                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/coffee`                   | HTCPCP, [RFC 2324](https://www.rfc-editor.org/rfc/rfc2324)                                           | GET and POST return HTTP 418 with a teapot explanation. Accept selects plain text or HTML.                                                            |
| `/tea`                      | HTCPCP-TEA, [RFC 7168](https://www.rfc-editor.org/rfc/rfc7168)                                       | GET returns brewing instructions. POST accepts message/teapot start or stop commands; unsupported additions return 406.                               |
| prose links                 | none; links to `/coffee` and `/tea`                                                                  | A standalone "coffee" or "tea" in writing and initiative MDX becomes a quiet plain `<a>` (`lib/writings/remark-brews.ts`).                            |
| `/whoami`                   | none; echoes the request                                                                             | GET returns the request IP, user agent, and available host location/network data as text or HTML. The response is not cached or stored.               |
| every path                  | `X-Clacks-Overhead: GNU Terry Pratchett`                                                             | Defined in `lib/http/response-headers.ts`, served by `headers()` in `next.config.ts`.                                                                 |
| every page                  | `Link` header, [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288)                                    | The head's Webmention, Micropub, IndieAuth, and WebSub hub links, for clients that read headers. See the Link header note below.                      |
| every path                  | Security headers                                                                                     | `nosniff`, a pinned referrer policy, a permissions policy, and an opener policy on pages. See the security headers note below.                        |
| `/.well-known/security.txt` | [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)                                                   | GET returns the security reporting contact, policy, and expiration. Renew the configured expiration before it lapses.                                 |
| `/opensearch.xml`           | [OpenSearch](https://github.com/dewitt/opensearch/blob/master/opensearch-1-1-draft-6.md) description | GET returns the description browsers use to register the site as a search engine. Queries go to `/search?q=`.                                         |
| `/api/mcp`                  | [Model Context Protocol](https://modelcontextprotocol.io), Streamable HTTP                           | GET and POST handle unauthenticated, read-only content tools over MCP; OPTIONS returns browser preflight headers. See the MCP section for tool names. |
| `/llms.txt`                 | [llmstxt.org](https://llmstxt.org)                                                                   | GET returns a Markdown site summary, published writings, feeds, and configured protocol endpoints. Production responses exclude drafts.               |
| `/humans.txt`               | [humanstxt.org](https://humanstxt.org)                                                               | GET returns the site author, credits, technologies, and deployment build date when available.                                                         |
| every page                  | [Fragmention](https://indieweb.org/fragmention)                                                      | A URL ending in `##some+words` scrolls to and highlights the first place those words appear. See the fragmentions note below.                         |
| every page                  | [Speculation rules](https://developer.mozilla.org/docs/Web/API/Speculation_Rules_API)                | Prefetches in-site pages on hover. See the speculation rules note below.                                                                              |

## humans.txt

### Build metadata and package names

`/humans.txt` names the person and tools behind the site. Its TEAM block reads
Willie's name, the canonical origin, and the hello address from `site.emails`.
The SITE block's `Last update` records the build day in the site's time zone,
not the time of the visitor's request.

`next.config.ts` sets `SITE_BUILT_AT`, which Next inlines during the build so the
prerendered file keeps that date. The Components line names packages in
`package.json`; `tests/unit/protocols/humans-txt.test.mts` detects when a named package
leaves the manifest. Update the Standards line when a protocol is added or
removed rather than allowing the file to become a list of former capabilities.

### Author discovery order

The head links the file as a second `rel="author"` with `type="text/plain"`,
after the link to the homepage. The IndieWeb authorship algorithm follows the
first `rel="author"` link to find the author's h-card, so the homepage has to
stay first.

## The Link header

### One discovery list for HTML and HTTP

Webmention, Micropub, IndieAuth, and WebSub clients may discover endpoints from
an HTTP `Link` header without parsing the page, so every page response carries
the same links the head does. Both render `ENDPOINT_DISCOVERY_LINKS` in
`lib/indieweb/discovery-links.ts`, with the same relative paths, so a preview
deployment advertises its own endpoints. Next adds a second `Link` header of its
own for font and image preloads; HTTP treats the two as one list.

### Page scope and config imports

Discovery headers belong on pages. Advertising a Webmention receiver from a feed
or JSON endpoint would suggest that the document itself is a supported mention
target. `PAGE_SOURCES` in `lib/http/response-headers.ts` limits the shared header to
page routes. Its unit test walks `app/` and fails if a new page is omitted or a
route handler accidentally matches.

The files imported through `next.config.ts` use relative imports. In this config
loading path, resolving `@/` from a file under `lib/` has produced “Cannot find
module” build failures. Preserve those relative imports when moving a shared
header or discovery constant; the normal application alias path is not evidence
that the config loader will resolve it the same way.

## Security headers

`lib/http/response-headers.ts` centralizes the following policies. Their scope matters:
a policy that works on a reading page can interrupt an authentication popup.
Keep the exceptions alongside the shared rules when changing them.

| Header                       | Value                                                                              | Where                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `X-Content-Type-Options`     | `nosniff`                                                                          | every path                                                                                                |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                                                  | paths outside `/admin/`, `/indieauth/`, `/atproto/`, and `/api/atproto/`; specialized routes can override |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()` | every path                                                                                                |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups`                                                         | pages only (`PAGE_SOURCES`), never IndieAuth                                                              |

### Referrers and embedded capabilities

The shared referrer policy pins `strict-origin-when-cross-origin` for the routes
it covers. Routes with their own policy are excluded because a
`next.config.ts` header can replace the handler's value. IndieAuth consent and
AT Protocol authorization responses use `no-referrer`; admin responses use
`same-origin`. Generated widget documents also receive `no-referrer` through a
more specific shared-header rule. `tests/e2e/site/site/routes.spec.mts` checks the consent
page's policy.

The permissions policy denies the listed camera, microphone, location, and
advertising capabilities to pages and embedded content, including YouTube,
Spotify, and SoundCloud embeds. It retains both the older `interest-cohort`
switch and `browsing-topics`. The header describes what this site permits; it
does not depend on an embed currently asking to use a capability.

### Preserve client authentication popups

The opener policy stays off the `/indieauth/` routes. A Micropub client may open
sign-in in a popup and, once the popup lands back on its own redirect page, read
`window.opener` to hand over the code. The policy on any page in that chain
would cut the popup loose. The site's own popups (the palette's new-tab results
and the share links) open with `noopener` or through `navigator.share` and need
no opener either way.

### Content security policy and rendering tradeoffs

Ordinary reading pages have no `Content-Security-Policy`. They include inline
theme code, Next's React Server Component payload, and the Google tag snippet.
Restricting those scripts needs a policy that authorizes the intended inline
code without authorizing arbitrary injected code as well.

A nonce-based approach would introduce request-specific rendering. The installed
[Next guide](../../../node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md)
requires dynamic rendering to apply per-request nonces; that conflicts with the
site's static prerendering and Partial Prerendering. Its experimental SRI option
covers script files rather than those inline scripts. Allowing `'unsafe-inline'`
would leave the inline-script issue unresolved, so adding such a policy would not
supply that protection by itself.

The exceptions have narrower needs. IndieAuth consent renders no scripts and
sets its own strict policy. Generated widget documents receive
`sandbox allow-scripts; frame-ancestors 'self'` in `lib/http/response-headers.ts`,
including when opened directly. Those route-specific policies do not establish
that the general reading pages have a CSP.

## Fragmentions

### Matching and navigation

A fragmention links to words already on a page rather than to an authored element
ID. For example, `##some+words` asks the page to find “some words.” The component
percent-decodes the hash, treats `+` as a space, and ignores case and line breaks
while looking for the first visible matching text node inside `<main>`.

`components/site/Fragmention.tsx` mounts once in the root layout. It checks on
load and `hashchange`, and also after client-side navigation. That extra check
matters because Next changes history with `pushState`, which does not fire
`hashchange`; the Navigation API's `navigatesuccess` supplies the notification.

The match scrolls to the middle of the window and receives a highlight. Hidden
headings do not compete with visible text, so a note's screen-reader-only title
cannot take a match away from its body. Matching is tested in `lib/site/fragmention.ts`,
and `tests/e2e/site/site/fragmention.spec.mts` exercises the navigation on real pages.

### Highlight without changing the DOM

The highlight must leave React's page structure alone. An earlier approach
inserted `<mark>` before streamed content finished hydrating; React reported a
hydration mismatch (minified error #418) and rendered `<main>` again on the
client. The browser and React no longer agreed on the nodes they were reconciling.

The current implementation uses a CSS Custom Highlight, styled through
`::highlight(fragmention)` in `app/globals.css`. It changes no DOM nodes, uses
the page's brand scheme, and does not animate. Since that highlight cannot draw
an outline, an underline marks its edge.

### Matching and browser limits

Words that cross an element boundary, such as a phrase that runs into a link,
match nothing, because the search reads one text node at a time. A browser
without the Custom Highlight API still scrolls to the words, and one without the
Navigation API follows a fragmention only on load and on `hashchange`.

## Speculation rules

### Candidates and exclusions

The root layout carries a `<script type="speculationrules">` built from
`lib/site/speculation-rules.ts`. It prefetches same-origin links at `moderate`
eagerness. The intended desktop interaction is a short hover before fetching;
the browser controls when a candidate becomes eligible. The rule skips `/api/`, the feeds and activity feeds, `/micropub`, `/webmention` and
`/webmentions`, `/indieauth/`, `/oembed`, `/coffee`, `/tea`, `/whoami`,
`/.well-known/`, any path with a file extension, and any link with
`rel~="nofollow"`, `target="_blank"`, or `download`.

### Why the rule fetches documents

The browser's document navigation and Next's client-side navigation use different
representations of a page. `SiteLink` wraps Next's `<Link>`. After hydration,
clicking it uses a React Server Component (RSC) payload; Next already prefetches
route data for links entering the viewport in production, as described by the
installed [prefetching guide](../../../node_modules/next/dist/docs/01-app/02-guides/prefetching.md).

Speculation rules fetch the HTML document instead. That helps when the browser
takes the navigation: a click before hydration, a visitor without JavaScript, or
a navigation handed back to the browser. Prerendering would go further and run
the whole document, including scripts and analytics, even though the hydrated
Next router would navigate using its own payload rather than activate that
prerendered page. The rule therefore prefetches documents without prerendering.

### Bandwidth cost and inspection

After hydration, an eligible hovered link can still fetch HTML even if the
subsequent click uses Next's already-prefetched route data. That request may not
help the navigation. If that ever shows up in bandwidth, limit the rule to the page before
hydration, for example with a `not` `selector_matches` on an attribute a client
component sets on `<html>`. `tests/unit/site/speculation-rules.test.mts` checks the
exclusions with `URLPattern`, and `tests/e2e/site/site/speculation.spec.mts` reads the
candidate list Chromium reports through its DevTools Preload domain.

## In the command palette

Visitors can encounter these routes through the ⌘K palette in `lib/search/palette/`.
Entering a whole hidden command name and pressing Enter performs its action;
partial names do not match, and the commands do not appear in the ordinary list.

`brew`, `coffee`, and `teapot` send `POST /coffee`; `tea` starts a pot at
`/tea`. `whoami`, `clacks`, and `security` fetch their routes. `mcp` copies the
client configuration for `/api/mcp`, `llms` opens `/llms.txt`, `humans` opens
`/humans.txt`, and `fortune` selects a tagline. A failed request shows its
failure rather than a simulated successful response.

Add a corresponding command to `eggs()` in `lib/search/palette/commands.ts` when a new
route should be discoverable this way. The palette is another client of the
route, so the HTTP response remains the source of its result.

## Try them

```sh
curl -i https://willie.page/coffee
curl -i -X POST -H 'Content-Type: message/teapot' -H 'Accept-Additions: Whole-milk' -d start https://willie.page/tea
curl https://willie.page/whoami
curl https://willie.page/humans.txt
curl -I https://willie.page/ | grep -i clacks
```

## Known limits

- **Local Node rejects `BREW` and `WHEN`.** Its HTTP parser returns 400 before
  a route sees those methods. `/tea` therefore uses the RFC's supported `POST`
  form. The local parser result does not establish current Cloudflare handling
  of an unfamiliar method; retain that as unverified unless a hosted check runs.
- **Request metadata is host-dependent.** `app/whoami/route.ts` reads
  `getCloudflareContext().cf` and passes it to `whoamiResponse`. Hosted requests
  can include country, region, city, HTTP version, TLS, colo, ASN, and round-trip
  time. A local Next request has no Cloudflare context and uses the response's
  fallback rather than inventing those values.

## MCP server

The Model Context Protocol (MCP) endpoint lets compatible clients ask for the
site's profile, writings, search results, and initiatives through named tools.
`/api/mcp` is stateless and built with `mcp-handler` in `lib/mcp/site-server.ts`.
Its tools are read-only; the production content adapters apply the site's public
content rules, so the endpoint requires no sign-in. Point a client at
`https://willie.page/api/mcp`.

### Published content and source access

`lib/mcp/site-content.ts` connects tools to the site's loaders. In production,
those loaders hide drafts, so an all-draft collection produces no
`list_writings` or `search_writings` results, just as `/writings` does. Static
pages remain searchable through `/search`. Development loaders can expose drafts,
but the search index always excludes them.

The `SiteContent` interface lets tool tests use plain data without loading the
Next runtime. That separation tests the tools' response behavior; it does not
substitute for checking which deployed content the production adapter supplies.

`get_writing` returns MDX source, not the rendered page. JSX such as `<Ref>` or
`<SpotifyEmbed>` therefore appears as text for the client to interpret. The tool
is useful for retrieving the original writing, but it does not reproduce the
browser's component rendering.

### Browser clients and discovery

The route answers a CORS preflight and sends
`Access-Control-Allow-Origin: *` (`lib/mcp/cors.ts`), so a browser-hosted MCP
client on another origin can call it. `robots.txt` allows `/api/mcp` under the
otherwise disallowed `/api/`, matching the link in `/llms.txt`.

### Traffic limits

The endpoint has no rate limiter in code. A per-process counter would cover only
one serverless instance, so it would not impose a shared traffic limit. If
traffic needs limiting, add a host firewall rule for `/api/mcp` rather than
treating an instance-local counter as protection for the endpoint.

### Registry listing remains unimplemented

The site has no implemented registry listing. The retained proposal uses a
reverse-DNS name derived from the domain, so it would publish as `page.willie/...`, proved with a
DNS TXT record (`v=MCPv1; k=ed25519; p=<public key>`) or a
`/.well-known/mcp-registry-auth` file. Verify the registry's current requirements before implementing that proposal;
these proof examples do not establish a completed registration.
