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
| `/whoami`                   | none; echoes the request                                                                             | Plain text for `curl`, HTML for browsers, never cached or stored. See the host note below.                                                                                                              |
| every path                  | `X-Clacks-Overhead: GNU Terry Pratchett`                                                             | Defined in `lib/response-headers.ts`, served by `headers()` in `next.config.ts`.                                                                                                                        |
| `/.well-known/security.txt` | [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)                                                   | `Expires` is required and must stay under a year out. A unit test fails 30 days before it lapses; renew `SECURITY_TXT_EXPIRES`.                                                                         |
| `/opensearch.xml`           | [OpenSearch](https://github.com/dewitt/opensearch/blob/master/opensearch-1-1-draft-6.md) description | Lets a browser add the site as a search engine. Queries go to `/search?q=`. Root layout advertises it with `<link rel="search">`.                                                                       |
| `/api/mcp`                  | [Model Context Protocol](https://modelcontextprotocol.io), Streamable HTTP                           | Read-only and unauthenticated: `get_profile`, `list_writings`, `get_writing`, `search_writings`, `list_initiatives`, and `brew_coffee`, which answers with a 418 tool error. See the MCP section below. |
| `/llms.txt`                 | [llmstxt.org](https://llmstxt.org)                                                                   | An H1, a summary, and `- [name](url): notes` lists of the published writings, feeds, and protocol endpoints. Drafts never appear.                                                                       |

## Try them

```sh
curl -i https://willie.page/coffee
curl -i -X POST -H 'Content-Type: message/teapot' -H 'Accept-Additions: Whole-milk' -d start https://willie.page/tea
curl https://willie.page/whoami
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
