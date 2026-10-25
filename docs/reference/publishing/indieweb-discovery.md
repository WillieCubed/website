# IndieWeb discovery and routes

Maintainers use this reference to identify public protocol endpoints and their storage requirements. Shared identity comes from `lib/site/identity.ts`; protocol endpoint names and the WebSub hub come from `lib/indieweb/constants.ts`. An isolated build sets `NEXT_PUBLIC_SITE_ORIGIN` before building so its discovery links point to that environment.

## Routes

| Route                                                              | Purpose                                                                                                                | Needs                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/webmention` (alias of `/api/webmention`)                         | Receives webmentions, verifies the source, stores them for moderation                                                  | Postgres                                                     |
| `/webmentions?target=`                                             | Public JSON list of approved webmentions for one page                                                                  | Postgres                                                     |
| `/api/webmention/moderate`                                         | `GET` lists pending webmentions; `POST` approves or rejects one; see [moderation](webmention.md#moderation)            | Postgres, `WEBMENTION_MODERATION_SECRET`                     |
| `/activity/feed.xml`, `/activity/feed/atom`, `/activity/feed/json` | Site-wide feed of approved webmention activity; empty without a database                                               | Postgres (optional)                                          |
| `/writings/[slug]/activity/feed.*`                                 | Same three formats scoped to one writing                                                                               | Postgres (optional)                                          |
| `/micropub`                                                        | `GET ?q=config`, `?q=syndicate-to`, `?q=category`, `?q=source`; `POST` creates, updates, deletes and restores writings | IndieAuth token; see [Micropub](micropub.md)                 |
| `/micropub/media`                                                  | Micropub media endpoint; `POST` stores one image, audio, video or PDF file and answers 201 with its `Location`         | IndieAuth token, Cloudflare R2 media binding                 |
| `/.well-known/oauth-authorization-server`                          | IndieAuth server metadata; the head's `rel="indieauth-metadata"` points here                                           | nothing                                                      |
| `/indieauth/auth`                                                  | IndieAuth authorization endpoint; `GET` forwards to the consent page, `POST` redeems a code for the profile URL        | Postgres                                                     |
| `/indieauth/consent`                                               | The owner's consent page; approving needs a signed Cloudflare Access identity                                          | Postgres, owner Access configuration                         |
| `/indieauth/token`                                                 | Token endpoint; `POST` exchanges a code or rotates a refresh grant, `GET` with a bearer token verifies one             | Postgres                                                     |
| `/indieauth/userinfo`                                              | Permitted profile information for an active bearer token                                                               | Postgres                                                     |
| `/indieauth/introspect`, `/indieauth/revoke`                       | Token introspection (RFC 7662) and revocation (RFC 7009); see [IndieAuth](indieauth.md)                                | Postgres; `INDIEAUTH_INTROSPECTION_SECRET` for introspection |
| `/oembed?url=`                                                     | oEmbed provider for any page on the canonical origin                                                                   | nothing                                                      |
| `/search?q=`, `/api/search?q=`                                     | Server-rendered search over writings, initiatives, and pages, answered from this domain                                | nothing (Postgres optional)                                  |
| ⌘K on every page                                                   | Command palette over the same Pagefind index as `/search`, served from `/pagefind/`                                    | nothing                                                      |
| `/llms.txt`                                                        | llmstxt.org map of published writings, feeds, and protocol endpoints                                                   | nothing                                                      |
| `/api/mcp`                                                         | Read-only MCP server; see [protocols.md](protocols.md)                                                                 | nothing                                                      |
| `/.well-known/webfinger`, `/.well-known/host-meta`                 | Identity discovery for `acct:willie@willie.page`                                                                       | nothing                                                      |
| `/.well-known/host-meta.json`                                      | The same host-meta LRDD link as JSON                                                                                   | nothing                                                      |
| `/.well-known/atproto-did`                                         | Publishes the AT Protocol DID from `site.author.atprotoDid`; 404 without one                                           | `NEXT_PUBLIC_ATPROTO_DID`                                    |
| `/.well-known/site.standard.publication`                           | standard.site verification: the AT-URI of the publication record; see [atproto.md](atproto.md)                         | `NEXT_PUBLIC_ATPROTO_DID`, `ATPROTO_PUBLICATION_RKEY`        |
| `/feed.xml`, `/feed/atom`, `/feed/json`                            | Site feeds for writings, initiatives, and projects; each declares the WebSub hub                                       | nothing                                                      |
| `/writings/feed.xml`, `/writings/feed/atom`, `/writings/feed/json` | Writings-only feeds, advertised from `/writings`                                                                       | nothing                                                      |
| `/writings/tags/[tag]`                                             | One published tag's h-feed; `/writings?tag=` redirects here with a 308                                                 | nothing                                                      |
| `/writings/tags/[tag]/feed.xml`, `/feed/atom`, `/feed/json`        | The same three formats scoped to one tag, advertised from its page                                                     | nothing                                                      |

### Database-dependent routes

Publishing state uses `lib/db/postgres.ts`: a direct `POSTGRES_URL` or
`DATABASE_URL` locally and the `HYPERDRIVE` binding in Workers. The module opens
request-scoped clients in Workers rather than retaining a connection object
across invocations. Hyperdrive provides the hosted connection pool.

Private Studio drafts use a separate `STUDIO_HYPERDRIVE` binding or local
`STUDIO_DATABASE_URL`. The public publishing database is not a fallback for
private draft source. Without a ready publishing database, Webmention routes
fail and activity feeds are empty; other database-backed authorization and
administration also depend on their respective stores. Public MDX loaders can
still read their packaged content.

## Current release contract

The [conformance boundaries](publishing-conformance.md) distinguish supported
behavior from the evidence needed on a release. The
[configuration reference](indieweb-configuration.md#migration-ordering) owns
migration order. Inspect the selected database's applied schema before serving
new code; an older acceptance receipt does not establish its current state.
