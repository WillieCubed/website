# IndieWeb

The [supported-behavior specification](spec.md) states what clients can rely
on and how each behavior is checked. The [HTTP test runbook](testing.md)
shows how to repeat the checks. This page records the routes, setup, and
operating details.

This page is for whoever changes an IndieWeb route, a feed, or a post kind on
this site, Willie or an agent. It lists what the site exposes, which
environment variables switch each part on, and where the site stands against
[IndieMark](https://indieweb.org/IndieMark) levels 1 through 3. When you add
or remove a route, update the tables here and rerun `pnpm test`.

The canonical origin, author name, photo, and social profiles all come from
`lib/site.ts`. Protocol endpoints and the WebSub hub are named once in
`lib/indieweb/constants.ts`. `NEXT_PUBLIC_SITE_ORIGIN` overrides the origin
for an isolated deployment. Do not write the hostname anywhere else.

## Routes

| Route                                                              | Purpose                                                                                                         | Needs                                                        |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/webmention` (alias of `/api/webmention`)                         | Receives webmentions, verifies the source, stores them for moderation                                           | Postgres                                                     |
| `/webmentions?target=`                                             | Public JSON list of approved webmentions for one page                                                           | Postgres                                                     |
| `/api/webmention/send`, `/api/webmention/send-all`                 | Send webmentions for one post or every post; bearer `WEBMENTION_SECRET`                                         | Postgres, `WEBMENTION_SECRET`                                |
| `/api/webmention/moderate`                                         | `GET` lists pending webmentions; `POST` approves or rejects one; see Moderation                                 | Postgres, `WEBMENTION_MODERATION_SECRET`                     |
| `/activity/feed.xml`, `/activity/feed/atom`, `/activity/feed/json` | Site-wide feed of approved webmention activity; empty without a database                                        | Postgres (optional)                                          |
| `/writings/[slug]/activity/feed.*`                                 | Same three formats scoped to one writing                                                                        | Postgres (optional)                                          |
| `/micropub`                                                        | `GET ?q=config` and `?q=syndicate-to`; `POST` creates a note, photo, or article                                 | IndieAuth token; see Micropub                                |
| `/micropub/media`                                                  | Micropub media endpoint; `POST` stores one photo and answers 201 with its `Location`                            | IndieAuth token, `BLOB_READ_WRITE_TOKEN`                     |
| `/.well-known/oauth-authorization-server`                          | IndieAuth server metadata; the head's `rel="indieauth-metadata"` points here                                    | nothing                                                      |
| `/indieauth/auth`                                                  | IndieAuth authorization endpoint; `GET` forwards to the consent page, `POST` redeems a code for the profile URL | Postgres                                                     |
| `/indieauth/consent`                                               | The owner's consent page; approving needs a code from the authenticator app                                     | Postgres, `INDIEAUTH_TOTP_SECRET`                            |
| `/indieauth/token`                                                 | Token endpoint; `POST` exchanges a code for a token, `GET` with a bearer token verifies one                     | Postgres                                                     |
| `/indieauth/introspect`, `/indieauth/revoke`                       | Token introspection (RFC 7662) and revocation (RFC 7009); see IndieAuth                                         | Postgres; `INDIEAUTH_INTROSPECTION_SECRET` for introspection |
| `/oembed?url=`                                                     | oEmbed provider for any page on the canonical origin                                                            | nothing                                                      |
| `/search?q=`, `/api/search?q=`                                     | Server-rendered search over writings, initiatives, and pages, answered from this domain                         | nothing (Postgres optional)                                  |
| `/api/search/reindex`                                              | Rebuilds the Postgres search table; returns 503 unless `SEARCH_BACKEND=postgres`                                | Postgres, `SEARCH_REINDEX_SECRET`                            |
| ⌘K where the search button shows                                   | Pagefind dialog over the same content as `/search`; its index is served from `/pagefind/`                       | nothing                                                      |
| `/llms.txt`                                                        | llmstxt.org map of published writings, feeds, and protocol endpoints                                            | nothing                                                      |
| `/api/mcp`                                                         | Read-only MCP server; see [protocols.md](../protocols.md)                                                       | nothing                                                      |
| `/.well-known/webfinger`, `/.well-known/host-meta`                 | Identity discovery for `acct:willie@willie.page`                                                                | nothing                                                      |
| `/.well-known/host-meta.json`                                      | The same host-meta LRDD link as JSON                                                                            | nothing                                                      |
| `/.well-known/atproto-did`                                         | Publishes the AT Protocol DID from `site.author.atprotoDid`                                                     | nothing                                                      |
| `/feed.xml`, `/feed/atom`, `/feed/json`                            | Site feeds for writings and initiatives; each declares the WebSub hub                                           | nothing                                                      |
| `/writings/feed.xml`, `/writings/feed/atom`, `/writings/feed/json` | Writings-only feeds, advertised from `/writings`                                                                | nothing                                                      |

Every route that says "Postgres" reads `POSTGRES_URL` through
`@vercel/postgres`. Without it the webmention routes return errors and the
activity feeds return empty documents; nothing else on the site notices.

## Markup

Each writing page is an `h-entry` with `p-name`, `p-summary`, `e-content`,
`dt-published`, `dt-updated`, `p-category`, and `u-url u-uid`. No entry
carries a `p-author`: the top bar's link home is `rel="author"`, the head
repeats it as a `<link>`, and the homepage `h-card` has `u-url u-uid` equal
to its own URL, so it is the representative card. That is the authorship
algorithm's documented fallback (indieweb.org/authorship-spec), and it keeps
the author's name off every page that is already under the author's name.
The homepage `h-card` is the rail in `components/home/Rail.tsx`: the
headline's name is its `p-name`, the line under it its `p-note`, and the
photo and email are `<data class="u-photo">` and `<data class="u-email">`,
because on the homepage the contact links belong to the footer, which grows
out of the rail's foot. The `rel="me"` links are the footer's profile links,
on every page.
`/writings` and `/initiatives` are each an `h-feed` with its own `p-name`,
`u-url`, and a hidden `p-author h-card` (`components/indieweb/FeedAuthor.tsx`)
that links to the homepage, so the entries listed in them inherit an author
without a byline. Each initiative on `/initiatives` is an `h-entry` with
`p-name`, `u-url`, and `p-summary`. Notes omit the visible headline; the
loader derives `title` from the first sentence so feeds and the index still
have text, and `WritingHeader` renders that derived title inside an
`sr-only` heading.

Post kinds map to these properties in `WritingHeader.tsx` and
`ReplyTarget.tsx`, and person tags in `WritingContent.tsx`.
`docs/content/writings.md` explains the frontmatter.

| Frontmatter   | Property                                   |
| ------------- | ------------------------------------------ |
| `inReplyTo`   | `u-in-reply-to`                            |
| `likeOf`      | `u-like-of`                                |
| `repostOf`    | `u-repost-of`                              |
| `bookmarkOf`  | `u-bookmark-of`                            |
| `rsvp`        | `p-rsvp` plus `u-in-reply-to` on the event |
| `syndication` | `u-syndication`, one per entry             |
| `photo`       | `u-photo`, one `<img>` per photo           |
| `people`      | `u-category h-card`, one per person        |

Approved webmentions render at the foot of the post, inside its `h-entry`.
A reply is a `p-comment h-cite` with `u-url` (the reply's own page),
`dt-published`, `p-content`, and a `p-author h-card`. Likes, reposts, and
bookmarks are facepiles: each face is a `u-like`, `u-repost`, or
`u-bookmark` `h-cite` with the same author card, and a line beside it names
who reacted. The post page reads them through a `'use cache'` loader with
`cacheLife('minutes')`, so an approval shows within about a minute without
a deploy. Do not move the read to request time: a streamed section lands
after the page, outside the `h-entry`, and parsers lose the comments.
Author photos load straight from the author's site, since the image
optimizer only accepts the hosts in `next.config.ts`.
`tests/unit/webmention-display.test.mts` parses the rendered markup.
Initiative and part pages show their approved mentions the same way through
`components/indieweb/PageWebmentions.tsx`, at the foot of the page. Those
pages carry no `h-entry`, so the mentions there are standalone `h-cite`s.

`@handle` in prose becomes a link through `lib/writings/remark-mentions.ts`.
`@thewilliediaries` and `@williecubed` map to their Instagram profiles, and any
other handle links to `https://instagram.com/<handle>`. Add an entry to
`MENTION_TARGETS` when a handle lives somewhere else.

## Moderation

A received webmention is stored unapproved, and every page, feed, and
`/webmentions` query shows only verified, approved ones, so nothing appears
until Willie approves it. There is no auto-approve rule. Moderate from a
terminal with the database URL in the environment:

```sh
pnpm webmentions:moderate                   # list what is waiting
pnpm webmentions:moderate approve <id...>   # show them on the site
pnpm webmentions:moderate reject <id...>    # hide them for good
```

Or over HTTP with `Authorization: Bearer $WEBMENTION_MODERATION_SECRET`:
`GET /api/webmention/moderate` returns `{ count, pending }`, and `POST` with
`{ "action": "approve" | "reject", "id": "<uuid>" }` applies one decision.
Without the secret the route answers 503; with a wrong one, 401. The route is
meant to move behind Cloudflare Access later, with the secret kept as a
second check.

Only a verified mention can be approved; unverified ones are listed, marked
`(unverified)`, so they can be rejected. Rejecting sets `is_deleted`, the same
soft delete the verifier uses when a source goes away, so a resent mention from
that source stays hidden. Approving or rejecting an id that is not in a state
to change answers 404 from the route and exits 1 from the script.
Moderation logic and its tests live in `lib/indieweb/webmention-moderation.ts`
and `tests/unit/webmention-moderation.test.mts`.

## Receiving

A target may be any page on the canonical origin that exists: the homepage,
a routed page, an initiative or one of its parts, or a published writing,
which is the sitemap's list. Anything else gets a 400. The target is stored
under its canonical address, without a trailing slash, query, or fragment,
so it matches the address the page reads its mentions from. The verifier
then needs the source to link to that address, or to its path below the
homepage; a bare `/` never counts, since every page links to it. The logic
and its tests live in `lib/indieweb/webmention-targets.ts` and
`tests/unit/webmention-targets.test.mts`.

`POST /api/webmention` answers 202 once the mention is stored, then verifies
the source inside `after()` from `next/server`, which keeps a serverless
invocation alive until verification settles. Each client address may send 10
requests a minute; the counts live in the `webmention_rate_limits` table so
the limit holds across instances, and expired rows are pruned after each
accepted mention. If the table is missing or the count fails, the request goes
through and the error is logged. The logic and its tests live in
`lib/indieweb/webmention-rate-limit.ts` and
`tests/unit/webmention-rate-limit.test.mts`.

## Micropub

`POST /micropub` accepts form-encoded or JSON `h-entry` bodies with a bearer
token. The token must be one this site's own token endpoint issued: it is
looked up in the `indieauth_tokens` table (see IndieAuth below), with no call
to another server, and must be unexpired, unrevoked, carry the `create`
scope, and have a `me` on the canonical origin. Requests without a token get
401 and requests with a bad one get 403.

A valid request becomes an MDX file under `content/writings`. When
`MICROPUB_GITHUB_REPO` and `MICROPUB_GITHUB_TOKEN` are set the file is
committed through GitHub's Contents API on `MICROPUB_GITHUB_BRANCH` (default
`main`) so the post deploys like any hand-written one. Without those variables
the route writes into the local checkout. On a read-only deploy that write
fails with a 500 whose `error_description` names the reason, which is the
correct outcome on Vercel and Workers: set the GitHub variables there.

`?q=config` and `?q=syndicate-to` list two syndication targets, from
`MICROPUB_SYNDICATION_TARGETS` in `lib/indieweb/micropub.ts`:

| Name    | `uid`                                  |
| ------- | -------------------------------------- |
| Bluesky | `https://bsky.app/profile/willie.page` |
| Threads | `https://www.threads.com/@williecubed` |

Each `uid` is the profile URL and stays the same between releases, so a
client's saved choice keeps working. When a request carries
`mp-syndicate-to` (form `mp-syndicate-to` or `mp-syndicate-to[]`, or the JSON
property), each chosen target is written into the post's `syndication`
frontmatter under the target's name, and the page renders it as a
`u-syndication` link. A `uid` the endpoint never listed gets a 400
`invalid_request`. Nothing cross-posts: the endpoint does not publish to
Bluesky or Threads, so the recorded link points at the profile rather than a
copy of the post. Once a copy exists, replace that URL in the frontmatter with
the copy's permalink.

### Photos

`?q=config` advertises `/micropub/media` as the `media-endpoint` only when
`BLOB_READ_WRITE_TOKEN` configures storage. A client such as Quill uploads
each photo there first. The upload is the multipart
`file` part, and the token needs the `media` or the `create` scope. JPEG, PNG,
GIF, WebP, AVIF, and HEIC are accepted; SVG and anything else get a 400. The
file is stored as a public blob in Vercel Blob under
`media/<year>/<month>/<name>-<random>.<ext>`, and the endpoint answers 201
with the blob's URL in `Location` (and as `url` in the JSON body). Without
`BLOB_READ_WRITE_TOKEN` it answers 503 and names the variable.

The client then cites that URL as `photo` on the post: form `photo` or
`photo[]`, or the JSON property, where each value is a URL or
`{ "value": url, "alt": text }`. A post with a photo becomes `postType: photo`,
and the caption may be empty. Each photo is written into the `photo`
frontmatter as `{ url, alt }` and renders under the date in
`WritingHeader.tsx` as a `u-photo`. A photo value that is not an http(s) URL,
or a file sent straight to `/micropub`, gets a 400 `invalid_request`.

Storage sits behind the `MediaStore` interface in `lib/indieweb/media.ts`. To
move uploads to Cloudflare R2, add an R2 implementation there and return it
from `getMediaStore()`; the route and the posts do not change, though photos
already published keep their Vercel Blob URLs.

## IndieAuth

The site is its own IndieAuth server
([indieauth.spec.indieweb.org](https://indieauth.spec.indieweb.org/)), so
signing in to a Micropub client as `https://willie.page/` never leaves this
domain. Clients find it through `<link rel="indieauth-metadata">` in the
head, which points at `/.well-known/oauth-authorization-server`. The head
also keeps `rel="authorization_endpoint"` and `rel="token_endpoint"` for
older clients, and WebFinger returns the same three links. Both render
`INDIEAUTH_DISCOVERY_LINKS` from `lib/indieweb/discovery.ts`, so they cannot
disagree.

A sign-in runs like this:

1. The client sends the browser to `/indieauth/auth` with `client_id`,
   `redirect_uri`, `state`, an S256 `code_challenge`, and the scopes it wants.
   PKCE with S256 and `state` are required; `plain` is refused.
2. That forwards to `/indieauth/consent`, which checks the request. The
   `redirect_uri` must be on the client's own scheme, host, and port, or be
   listed by the client's metadata: a JSON document whose `client_id` is its
   own URL and which lists `redirect_uris`, or an HTML page with
   `<link rel="redirect_uri">`. The page's `h-app` or the JSON's
   `client_name` supplies the name shown. A bad `client_id` or `redirect_uri`
   is shown to the owner; any other error goes back to the client. Anyone
   can trigger this fetch, so it only reaches public addresses: every
   address a name resolves to is checked when the socket connects, which
   also stops DNS rebinding, redirects are followed by hand (three at most)
   and each hop is checked again, and the body is cut off at 1 MB. A
   `localhost` client is never fetched and gets the defaults.
3. The consent page lists the requested scopes as checkboxes and asks for the
   current code from the owner's authenticator app. Approving sends the
   client a code, with `state` and `iss`, for the scopes left checked.
   Denying sends `error=access_denied`.
4. The client redeems the code with its `code_verifier`, at
   `/indieauth/token` for an access token or at `/indieauth/auth` for the
   profile URL alone. A code lives ten minutes and is spent on the first
   attempt, right or wrong. A code issued without a scope only redeems at
   `/indieauth/auth`.

Access tokens last 90 days. There are no refresh tokens, so a client signs in
again after that. The `profile` scope adds the name, URL, and photo to the
response, and `email` beside it adds the email address.

| Endpoint                                   | Answers                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `POST /indieauth/token`                    | `{ access_token, token_type, scope, me, expires_in, profile? }`, or revokes with `action=revoke&token=` for older clients |
| `GET /indieauth/token` with a bearer token | `{ me, client_id, scope }`, or 401 for a token that is not active                                                         |
| `POST /indieauth/introspect` with `token=` | `{ active, me, client_id, scope, iat, exp }`; needs `Authorization: Bearer $INDIEAUTH_INTROSPECTION_SECRET`               |
| `POST /indieauth/revoke` with `token=`     | 200 whether or not the token existed                                                                                      |

To see or cut off what is signed in, query the table:
`SELECT client_id, scope, issued_at FROM indieauth_tokens WHERE revoked_at IS NULL`,
and set `revoked_at = NOW()` on a row to revoke it. The protocol logic lives
in `lib/indieweb/indieauth-server.ts`, the HTTP handlers in
`lib/indieweb/indieauth-endpoints.ts`, and their tests in
`tests/unit/indieauth-*.test.mts`.

### Owner sign-in

Approving a sign-in needs a six-digit TOTP code (RFC 6238). Run
`pnpm indieauth:totp` once: it prints a new secret and an `otpauth://` URI.
Add the URI to an authenticator app, set the secret as
`INDIEAUTH_TOTP_SECRET` in the deployment's environment, and redeploy. The
secret is never committed; without it the consent page answers 503. A code
works once, so a second sign-in within the same 30 seconds waits for the next
code. After ten wrong codes in a rolling 24 hours, sign-in pauses until the
oldest one ages out, even for the right code, while tokens already issued
keep working. That caps an attacker at ten guesses a day.

The consent flow only sees the `OwnerAuthenticator` interface in
`lib/indieweb/types.ts`. `lib/indieweb/indieauth-owner.ts` implements it
with TOTP, and `indieAuthEndpointOptions()` in
`lib/indieweb/indieauth-storage.ts` picks it. To move owner sign-in to
Cloudflare Access, put `/indieauth/consent`, and only that path, behind an
Access application. Then write an `OwnerAuthenticator` whose `verify` checks
the `Cf-Access-Jwt-Assertion` header against the team's signing keys and the
application's audience, with `prompt: 'none'` so the form stops asking for a
code, and return it from `indieAuthEndpointOptions()`. The other IndieAuth
endpoints are called by clients rather than the owner's browser, so they
must stay outside Access. The consent `POST` already refuses cross-site
submissions (`Sec-Fetch-Site`, then `Origin`, and neither is refused),
which matters once the owner check rides on a browser session.

### Bot challenges

Clients call `/indieauth/auth`, `/indieauth/token`, `/indieauth/introspect`,
`/indieauth/revoke`, `/.well-known/oauth-authorization-server`, and
`/micropub` from servers and apps, which cannot pass a browser challenge. If
Vercel's Bot Protection, Attack Challenge Mode, or a Firewall rule that
challenges is on, add a Firewall custom rule with the Bypass action, above
the challenging one, for requests whose path starts with `/indieauth/` or
`/micropub`, or equals `/.well-known/oauth-authorization-server`. The same
goes for any challenge Cloudflare puts in front of the site.

## Scripts

| Script                                        | What it does                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm search:index` (runs as `prebuild`)      | Writes `public/search-index.json` and the Pagefind index in `public/pagefind/` from published writings, initiatives and their parts, and pages. Both are gitignored. The Pagefind step needs its platform binary, which the `pagefind` package installs.                                                          |
| `pnpm websub:ping`                            | POSTs `hub.mode=publish` with the six feed URLs to `WEBSUB_HUB`.                                                                                                                                                                                                                                                  |
| `pnpm webmentions:send`                       | Sends webmentions for writings whose content hash changed. Skips itself without a database.                                                                                                                                                                                                                       |
| `pnpm webmentions:moderate`                   | Lists pending webmentions, or approves or rejects them by id; see Moderation. Needs `POSTGRES_URL`.                                                                                                                                                                                                               |
| `pnpm webmentions:backfill-authors`           | One-off repair for webmentions verified before the verifier read a `u-photo` with alt text: fills each missing author photo from the h-entry stored with the mention, through `extractAuthor`. It writes only rows with no photo, so a second run changes nothing. Without `POSTGRES_URL` it says so and exits 0. |
| `pnpm indieauth:totp`                         | Prints a new secret for `INDIEAUTH_TOTP_SECRET` and the `otpauth://` URI to add to an authenticator app; see IndieAuth.                                                                                                                                                                                           |
| `scripts/postbuild.mts` (runs as `postbuild`) | Runs `websub:ping` and `webmentions:send` only when `INDIEWEB_POSTBUILD=1`, and never fails the build.                                                                                                                                                                                                            |
| `pnpm test`                                   | `tsx --test tests/unit/*.test.mts`                                                                                                                                                                                                                                                                                |

## Environment variables

| Variable                                                                                           | Used by                                                     | Default                                 |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| `POSTGRES_URL` / `DATABASE_URL`                                                                    | webmentions, reply context, activity feeds, Postgres search | unset, features degrade                 |
| `WEBMENTION_SECRET`                                                                                | `/api/webmention/send*`                                     | unset, routes refuse                    |
| `WEBMENTION_MODERATION_SECRET`                                                                     | `/api/webmention/moderate`                                  | unset, route refuses                    |
| `INDIEAUTH_TOTP_SECRET`                                                                            | owner sign-in on `/indieauth/consent`                       | unset, sign-in answers 503              |
| `INDIEAUTH_INTROSPECTION_SECRET`                                                                   | `/indieauth/introspect`                                     | unset, route answers 503                |
| `MICROPUB_GITHUB_REPO`, `MICROPUB_GITHUB_TOKEN`, `MICROPUB_GITHUB_BRANCH`, `MICROPUB_CONTENT_PATH` | Micropub storage                                            | local write, `main`, `content/writings` |
| `BLOB_READ_WRITE_TOKEN`                                                                            | `/micropub/media` photo storage in Vercel Blob              | unset, route answers 503                |
| `SEARCH_BACKEND`                                                                                   | `postgres` switches search to Postgres                      | JSON index                              |
| `SEARCH_REINDEX_SECRET`                                                                            | `/api/search/reindex` in production                         | unset                                   |
| `INDIEWEB_POSTBUILD`                                                                               | `1` enables the postbuild pings                             | unset, postbuild no-ops                 |
| `SKIP_WEBMENTIONS`                                                                                 | `true` skips `webmentions:send`                             | unset                                   |

The Postgres schema lives in `initializeWebmentionsTable()` in
`lib/indieweb/webmention-storage.ts`, `initializeReplyContextTable()` in
`lib/indieweb/reply-context.ts`, and `lib/db/migrations/001_level4_tables.sql`
for `outgoing_webmentions`, `reply_context_cache`, and `search_index`. Apply
the SQL file with `psql "$POSTGRES_URL" -f lib/db/migrations/001_level4_tables.sql`.
`lib/db/migrations/002_webmention_rate_limits.sql` adds
`webmention_rate_limits`, which a database created before it needs; apply it
the same way. `lib/db/migrations/003_indieauth.sql` adds the IndieAuth
tables: `indieauth_codes` and `indieauth_tokens`, which hold SHA-256 digests
rather than the codes and tokens themselves, and `indieauth_totp_steps` and
`indieauth_sign_in_failures` for the owner check. Apply it before turning on
sign-in.

## IndieMark checklist

Status as of 2026-09-22. "Done" means the dev server serves it and a test or a
curl in this repo checks it.

| Level | Criterion                                                  | Status                  | Where                                                                            |
| ----- | ---------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| 1     | Own domain with an h-card                                  | Done                    | `lib/site.ts`, `components/home/Rail.tsx`                                        |
| 1     | rel="me" links to profiles that link back                  | Done                    | `site.social` in the footer                                                      |
| 1     | Posts on your own domain with h-entry                      | Done                    | `app/writings/[slug]/page.tsx`                                                   |
| 1     | Posts have permalinks and dates                            | Done                    | `u-url u-uid`, `dt-published`                                                    |
| 2     | Two or more post types                                     | Done                    | article `project-superbloom`, notes `fall-tour-2026-begins`, `indiemark-level-3` |
| 2     | Syndicate copies with links back (POSSE)                   | Done                    | `syndication` frontmatter, `u-syndication`                                       |
| 2     | Reply posts with `u-in-reply-to`                           | Done                    | `indiemark-level-3`                                                              |
| 2     | Send webmentions                                           | Done                    | `lib/indieweb/send-webmention.ts`, `webmentions:send`                            |
| 2     | Receive and display webmentions                            | Done, needs Postgres    | `/webmention`, `WebmentionSection`                                               |
| 2     | Feed autodiscovery on the posts page                       | Done                    | `alternates.types` in `app/writings/page.tsx`                                    |
| 3     | Search results on your own domain                          | Done                    | `/search?q=`                                                                     |
| 3     | Micropub endpoint that creates posts                       | Done                    | `/micropub`                                                                      |
| 3     | Authorship on every post                                   | Done                    | `rel="author"` in `TopBar.tsx` and the head; representative h-card in `Rail.tsx` |
| 3     | Likes, reposts, bookmarks, RSVPs render as h-entry         | Done, no live posts yet | `ReplyTarget.tsx`                                                                |
| 3     | WebSub hub declared in feeds and pinged on publish         | Done                    | `WEBSUB_HUB`, `websub:ping`                                                      |
| 3     | Autolinked mentions                                        | Done                    | `remark-mentions.ts`                                                             |
| 3     | Person tags                                                | Done, no live posts yet | `people` frontmatter, `WritingContent.tsx`, `webmentions:send`                   |
| 3     | Comments from other sites display, with reaction facepiles | Done, needs Postgres    | `WebmentionReplies.tsx`, `WebmentionSection.tsx`                                 |
| 3     | Photo posts                                                | Done, needs Vercel Blob | `/micropub/media`, `photo` frontmatter, `u-photo` in `WritingHeader.tsx`         |

## Not covered here

The IndieAuth server signs in one person, the site owner, and has no refresh
tokens or `userinfo` endpoint. Nothing federates over ActivityPub yet; that
plan is in `docs/future/activitypub.md`.
