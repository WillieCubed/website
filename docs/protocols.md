# Protocol easter eggs

This page is for whoever changes one of the site's small protocol routes,
Willie or an agent. Each one speaks a real protocol, not a copy of it. When you
add or remove one, update the table and rerun `pnpm test`.

Every handler is a Next route handler on Web-standard `Request` and `Response`,
so it moves with the site if the host changes (see [deploy.md](./deploy.md)).
The logic lives in `lib/` so the tests can call it without a server, and the
route file only forwards the request.

## Routes

| Route                       | Protocol                                                                                             | Notes                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `/coffee`                   | HTCPCP, [RFC 2324](https://www.rfc-editor.org/rfc/rfc2324)                                           | Every `GET` or `POST` gets a real 418, because this server is a teapot. The footer tagline "418 I'm a teapot." links here.        |
| `/tea`                      | HTCPCP-TEA, [RFC 7168](https://www.rfc-editor.org/rfc/rfc7168)                                       | `POST` a `message/teapot` body of `start` or `stop`. `Accept-Additions` allows the RFC 2324 milk types and answers 406 otherwise. |
| `/whoami`                   | none; echoes the request                                                                             | Plain text for `curl`, HTML for browsers, never cached or stored. See the host note below.                                        |
| every path                  | `X-Clacks-Overhead: GNU Terry Pratchett`                                                             | Defined in `lib/response-headers.ts`, served by `headers()` in `next.config.ts`.                                                  |
| `/.well-known/security.txt` | [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)                                                   | `Expires` is required and must stay under a year out. A unit test fails 30 days before it lapses; renew `SECURITY_TXT_EXPIRES`.   |
| `/opensearch.xml`           | [OpenSearch](https://github.com/dewitt/opensearch/blob/master/opensearch-1-1-draft-6.md) description | Lets a browser add the site as a search engine. Queries go to `/search?q=`. Root layout advertises it with `<link rel="search">`. |

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
