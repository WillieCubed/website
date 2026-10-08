# IndieWeb

The [supported-behavior specification](spec.md) states what clients can rely
on and how each behavior is checked. The [HTTP test runbook](testing.md)
shows how to repeat the checks. This page records the routes, setup, and
operating details.
The [publication review](publication-review.md) names the content that still
needs Willie's approval.

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

| Route                                                              | Purpose                                                                                                                | Needs                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/webmention` (alias of `/api/webmention`)                         | Receives webmentions, verifies the source, stores them for moderation                                                  | Postgres                                                     |
| `/webmentions?target=`                                             | Public JSON list of approved webmentions for one page                                                                  | Postgres                                                     |
| `/api/webmention/send`, `/api/webmention/send-all`                 | Send webmentions for one post or every post; bearer `WEBMENTION_SECRET`                                                | Postgres, `WEBMENTION_SECRET`                                |
| `/api/webmention/moderate`                                         | `GET` lists pending webmentions; `POST` approves or rejects one; see Moderation                                        | Postgres, `WEBMENTION_MODERATION_SECRET`                     |
| `/activity/feed.xml`, `/activity/feed/atom`, `/activity/feed/json` | Site-wide feed of approved webmention activity; empty without a database                                               | Postgres (optional)                                          |
| `/writings/[slug]/activity/feed.*`                                 | Same three formats scoped to one writing                                                                               | Postgres (optional)                                          |
| `/micropub`                                                        | `GET ?q=config`, `?q=syndicate-to`, `?q=category`, `?q=source`; `POST` creates, updates, deletes and restores writings | IndieAuth token; see Micropub                                |
| `/micropub/media`                                                  | Micropub media endpoint; `POST` stores one image, audio, video or PDF file and answers 201 with its `Location`         | IndieAuth token, Vercel Blob connection                      |
| `/.well-known/oauth-authorization-server`                          | IndieAuth server metadata; the head's `rel="indieauth-metadata"` points here                                           | nothing                                                      |
| `/indieauth/auth`                                                  | IndieAuth authorization endpoint; `GET` forwards to the consent page, `POST` redeems a code for the profile URL        | Postgres                                                     |
| `/indieauth/consent`                                               | The owner's consent page; approving needs a code from the authenticator app                                            | Postgres, `INDIEAUTH_TOTP_SECRET`                            |
| `/indieauth/token`                                                 | Token endpoint; `POST` exchanges a code or rotates a refresh grant, `GET` with a bearer token verifies one             | Postgres                                                     |
| `/indieauth/userinfo`                                              | Permitted profile information for an active bearer token                                                               | Postgres                                                     |
| `/indieauth/introspect`, `/indieauth/revoke`                       | Token introspection (RFC 7662) and revocation (RFC 7009); see IndieAuth                                                | Postgres; `INDIEAUTH_INTROSPECTION_SECRET` for introspection |
| `/oembed?url=`                                                     | oEmbed provider for any page on the canonical origin                                                                   | nothing                                                      |
| `/search?q=`, `/api/search?q=`                                     | Server-rendered search over writings, initiatives, and pages, answered from this domain                                | nothing (Postgres optional)                                  |
| `/api/search/reindex`                                              | Rebuilds the Postgres search table; returns 503 unless `SEARCH_BACKEND=postgres`                                       | Postgres, `SEARCH_REINDEX_SECRET`                            |
| ⌘K on every page                                                   | Command palette over the same Pagefind index as `/search`, served from `/pagefind/`                                    | nothing                                                      |
| `/llms.txt`                                                        | llmstxt.org map of published writings, feeds, and protocol endpoints                                                   | nothing                                                      |
| `/api/mcp`                                                         | Read-only MCP server; see [protocols.md](../protocols.md)                                                              | nothing                                                      |
| `/.well-known/webfinger`, `/.well-known/host-meta`                 | Identity discovery for `acct:willie@willie.page`                                                                       | nothing                                                      |
| `/.well-known/host-meta.json`                                      | The same host-meta LRDD link as JSON                                                                                   | nothing                                                      |
| `/.well-known/atproto-did`                                         | Publishes the AT Protocol DID from `site.author.atprotoDid`; 404 without one                                           | `NEXT_PUBLIC_ATPROTO_DID`                                    |
| `/.well-known/site.standard.publication`                           | standard.site verification: the AT-URI of the publication record; see [atproto.md](../atproto.md)                      | `NEXT_PUBLIC_ATPROTO_DID`, `ATPROTO_PUBLICATION_RKEY`        |
| `/feed.xml`, `/feed/atom`, `/feed/json`                            | Site feeds for writings and initiatives; each declares the WebSub hub                                                  | nothing                                                      |
| `/writings/feed.xml`, `/writings/feed/atom`, `/writings/feed/json` | Writings-only feeds, advertised from `/writings`                                                                       | nothing                                                      |
| `/writings/tags/[tag]`                                             | One published tag's h-feed; `/writings?tag=` redirects here with a 308                                                 | nothing                                                      |
| `/writings/tags/[tag]/feed.xml`, `/feed/atom`, `/feed/json`        | The same three formats scoped to one tag, advertised from its page                                                     | nothing                                                      |

Every route that says "Postgres" reads `POSTGRES_URL` through
`@vercel/postgres`. Without it the webmention routes return errors and the
activity feeds return empty documents; nothing else on the site notices.

## Current release contract

The [conformance matrix](../publishing-conformance.md) records current standards and external release gates. Migrations 006 and 007 add rotating IndieAuth refresh families and private Micropub deletion archives. Apply them to acceptance before production.

## Markup

Each writing page is an `h-entry` with `p-name`, `p-summary`, `e-content`,
`dt-published`, `dt-updated`, `p-category`, `u-url u-uid`, and a nested
`p-author h-card`. The top bar and head also link home with `rel="author"`.
The homepage `h-card` is the rail in `components/home/Rail.tsx`: the
headline's name is its `p-name`, the line under it its `p-note`, and the
photo and email are `<data class="u-photo">` and `<data class="u-email">`,
because on the homepage the contact links belong to the footer, which grows
out of the rail's foot. The `rel="me"` links are the footer's profile links,
on every page.
`/writings`, each tag page under `/writings/tags/`, and `/initiatives` are
each an `h-feed` with its own `p-name`, `u-url`, and a hidden
`p-author h-card` (`components/indieweb/FeedAuthor.tsx`) that links to the
homepage, so the entries listed in them inherit an author without a byline.
`/writings` and the tag pages also carry `<link rel="self">` beside the
layout's `rel="hub"`, and the publisher pings them, so a WebSub subscriber
to the page itself hears about new posts. Their entries render in the
static shell rather than inside a Suspense boundary, which would stream
them in after `</main>` and leave the feed empty for a parser. Each initiative on `/initiatives` is an `h-entry` with
`p-name`, `u-url`, and `p-summary`. Notes omit the visible headline; the
loader derives `title` from the first sentence so feeds and the index still
have text, and `WritingHeader` renders that derived title inside an
`sr-only` heading.

Post kinds map to these properties in `WritingHeader.tsx` and
`ReplyTarget.tsx`, and person tags in `WritingContent.tsx`. Each entry on
`/writings` and the tag pages (`WritingItem.tsx`) carries the same kind
properties as hidden markup, so a reader subscribed to an index gets the
whole entry: the page it answers as the same `u-*-of h-cite`, `p-rsvp`,
each photo as a `u-photo`, and, for a post without a headline, its whole
body as `e-content`, since the visible entry shows only the first
sentence. Articles leave their body to the permalink and carry
`p-summary`.
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
`dt-published`, its text, and a `p-author h-card`. A reply whose source
marked it up as `e-content` shows that markup as `e-content`, sanitized by
`lib/indieweb/comment-content.ts` when it is stored and again when it
renders. Only `p`, `br`, `a`, `em`, `strong`, `blockquote`, `code`, `ul`,
`ol`, and `li` survive, `b` and `i` become `strong` and `em`, and a link
keeps only an http(s) `href`, resolved against the reply, with
`rel="nofollow ugc"`. Script, style, and embedded documents go with their
text, and every other attribute goes. A reply given as `p-content` or a
summary shows as plain `p-content`. Both forms stop at 2,000 characters of
text and end in "…". The `content` column keeps the plain text for the
activity feeds, `/webmentions`, and moderation, and `content_html` holds the
markup. Readers render an RSS description as HTML, so the activity RSS feed
escapes that text once more; Atom and JSON Feed carry it as text.

Likes, reposts, bookmarks, and RSVPs are facepiles: each face is a
`u-like`, `u-repost`, `u-bookmark`, or `u-rsvp` `h-cite` with the same author
card, and a line beside it names who reacted. An RSVP is a reply whose h-entry carries a
`p-rsvp` of `yes`, `maybe`, `interested`, or `no`, compared without regard to
case. It is stored as type `rsvp` with the answer in the `rsvp` column, and
each face keeps the answer as `p-rsvp`. RSVPs sit in one facepile per answer,
in the order going, maybe, and interested. A `no` is stored and appears in
the activity feeds and `/webmentions`, but the post does not show it. No
single markup for received RSVPs is standard yet
([indieweb.org/rsvps](https://indieweb.org/rsvps)). `u-rsvp h-cite` is one
that other sites use, and it matches the facepiles beside it.

A mention, a page that links to the post without replying or reacting, is a
`u-mention h-cite` with `u-url`, `dt-published`, and a `p-author h-card`. It
shows the citing post's `p-name` when that post has a title apart from its
text, and otherwise the first 140 characters of its text as `p-content`. The
title is read from the h-entry stored with each mention, not from a column
of its own, so every stored mention has one. A mention whose markup names no
author shows its host instead.

The post page reads webmentions through a `'use cache'` loader with
`cacheLife('minutes')`, so an approval shows within about a minute without
a deploy. Do not move the read to request time: a streamed section lands
after the page, outside the `h-entry`, and parsers lose the comments.
Author photos load straight from the author's site, since the image
optimizer only accepts the hosts in `next.config.ts`.
`tests/unit/webmention-display.test.mts` parses the rendered markup.
Initiative and part pages show their approved mentions the same way through
`components/indieweb/PageWebmentions.tsx`, at the foot of the page. Those
pages carry no `h-entry`, so the mentions there are standalone `h-cite`s.

A part page's hero is an `h-event` (`components/initiatives/PartEvent.tsx`):
`p-name` is the standalone part title from `partTitle()`, with `u-url`,
`dt-start`, `dt-end`, the tagline as `p-summary`, and one `p-location h-adr`
per place carrying `p-locality`, `p-region`, `p-latitude`, and
`p-longitude`. The mentions sit outside the hero, so they stay standalone.
The page's JSON-LD graph carries the same trip as a schema.org `Event`
(`eventLd()` in `lib/seo/jsonld.ts`). `tests/unit/initiative-event.test.mts`
parses the rendered markup.

`@handle` in prose becomes a link through `lib/writings/remark-mentions.ts`.
`@thewilliediaries` and `@williecubed` map to their Instagram profiles, and any
other handle links to `https://instagram.com/<handle>`. Add an entry to
`MENTION_TARGETS` when a handle lives somewhere else.

## Moderation

A received webmention is stored unapproved, and every page, feed, and
`/webmentions` query shows only verified, approved ones, so nothing appears
until Willie approves it or a vouch does (see Vouch below). Moderate from a
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

A target may be any page on the site that exists: the homepage, a routed
page, an initiative or one of its parts, or a published writing, which is
the sitemap's list. Anything else gets a 400. The target may name a legacy
host such as `www.willie.page` or an alias host such as `tour.willie.page`,
because each one redirects to the canonical origin. It is stored under its
canonical address, without a trailing slash, query, or fragment, so it
matches the address the page reads its mentions from. The verifier then
resolves links against the fetched page's final URL and valid HTML base URL. An absolute or relative link counts when it resolves to the same target page on an allowed host. Distinct pages on the same site may mention each other. Identical source and target URLs are rejected. The logic
and its tests live in `lib/indieweb/webmention-targets.ts` and
`tests/unit/webmention-targets.test.mts`.

Anyone can name any source, so the verifier fetches it through
`fetchPublicDocument` in `lib/indieweb/public-fetch.ts`, the same guard the
IndieAuth client fetch uses. It reaches public addresses only, follows three
redirects at most and checks each hop, and gives up after 2 MB or ten
seconds. A source it refuses fails verification and stays unverified.

The h-entry that cites the target decides the mention's type, by which of its
properties cites the target: `like-of` makes a like, `repost-of` a repost,
`in-reply-to` a reply, or an RSVP when the entry also gives a `p-rsvp`
answer, and `bookmark-of` a bookmark. A source that only links to the
target, or has no h-entry, is a mention. The markup each type renders as is
under Markup.

The verifier finds who wrote the source with the
[authorship algorithm](https://indieweb.org/authorship-spec), in
`lib/indieweb/authorship.ts`. An embedded `p-author h-card` on the entry, or
else on its parent `h-feed`, is the author, and a plain-text author is only a
name. An author given as an address, or a permalink page's `rel=author` link
when the entry names no author, is fetched. That page's h-card whose `url` and
`uid` are both the page's address is the author. Failing that, the author is
the h-card whose `url` is one of the page's `rel=me` links, and failing that,
an h-card on the source page whose `url` is the author page. The author page
is fetched the same way, with a 1 MB and five-second limit. Nothing is
cached, so each verification fetches it again. When the entry names an author page that
yields no card, the mention keeps the address without a name.

`POST /api/webmention` answers 202 once the mention is stored, then verifies
the source inside `after()` from `next/server`, which keeps a serverless
invocation alive until verification settles. The same callback checks a
`vouch`, when one was sent (see Vouch), and sends the salmention a vouched
reply starts (see Salmention). Each client address may send 10
requests a minute; the counts live in the `webmention_rate_limits` table so
the limit holds across instances, and expired rows are pruned after each
accepted mention. If the table is missing or the count fails, the request goes
through and the error is logged. The logic and its tests live in
`lib/indieweb/webmention-rate-limit.ts` and
`tests/unit/webmention-rate-limit.test.mts`.

## Sending

A writing sends webmentions to the external links in its body, then to the
posts named by `inReplyTo`, `likeOf`, `repostOf`, `bookmarkOf`, and
`rsvp.eventUrl`, then to its tagged people. The deploy publisher
(`pnpm webmentions:send` and the notification endpoint),
`/api/webmention/send`, and `/api/webmention/send-all` all take that list
from `webmentionTargetsForWriting` in `lib/indieweb/send-webmention.ts`, so
a reply whose body never links its parent still notifies the parent. The
publisher hashes the list with the body, so reordering it resends every post
once.

## Vouch

A sender may add a `vouch` parameter
([indieweb.org/Vouch](https://indieweb.org/Vouch)): the address of a page,
on a domain this site trusts, that links to the sender's domain. A `vouch`
that is not an http(s) URL gets a 400. Without one, or when the check fails,
the webmention waits for moderation as before. After the source verifies,
`applyVouch` in `lib/indieweb/vouch.ts` approves it when every one of these
holds:

1. No webmention from the source's domain has been approved before. A known
   sender needs no vouch, so its vouch is ignored and it is moderated as
   usual.
2. The vouch page is on this site, or on a domain that accepted a webmention
   this site sent (a `sent` row in `outgoing_webmentions`), both before and
   after redirects.
3. The page, fetched from public addresses only within five seconds and
   1 MB, has an `<a>` or `<area>` whose `href` leads to the source's domain.

Domains compare in lowercase, without a port or a leading `www.`. The vouch
that approved a mention is kept in `vouch_url`, and the outcome is logged
as `Vouch for <source>: <outcome>`. To see every automatic approval, run
`SELECT source_url, vouch_url FROM webmentions WHERE vouch_url IS NOT NULL`.
To undo one, reject its id as in Moderation.

The spec lets a receiver trust any domain it has linked to. This site trusts
only domains that accepted its webmentions, because a silo runs no receiver:
a post linking to a GitHub repository must not let every GitHub page vouch
for a stranger. A multi-user host that does accept webmentions, such as
micro.blog, still lets any of its users vouch. The deploy publisher is the
only sender that writes `outgoing_webmentions`, so until it has run, only
this site's own pages can vouch.

## Salmention

When a reply to a writing is approved, the writing resends its webmentions
to the posts it answers: its `inReplyTo`, `likeOf`, `repostOf`,
`bookmarkOf`, and `rsvp.eventUrl`
([indieweb.org/Salmention](https://indieweb.org/Salmention)). The upstream
receiver fetches the writing again and finds the new reply among its
comments. `sendSalmention` in `lib/indieweb/salmention.ts` runs after an
approval through `/api/webmention/moderate`, after a vouch approves a reply,
and after `pnpm webmentions:moderate approve`, which approves every id first
and then sends. It works like this:

1. Only a reply to a published writing starts one. A like, repost,
   bookmark, RSVP, or mention does not, and neither does a reply to a page
   that is not a writing.
2. The upstream list leaves out this site's own pages and the reply's own
   source, so a reply from the post the writing answered is never sent back
   to it.
3. Nothing is sent until the live writing shows the reply's address. The
   route looks three times, ten seconds apart, after revalidating the page.
   The script cannot revalidate it, so it looks thirteen times, fifteen
   seconds apart, to wait out the minute the page caches its webmentions.
4. A writing sends at most one salmention every ten minutes, counted in the
   `salmentions` table. A reply approved inside that window reaches upstream
   with the next salmention after it, not on its own.

Only an approval starts a salmention; verifying a mention again never does.
So when an upstream site answers the salmention by pinging the writing,
nothing is sent back. Each outcome is logged as
`Salmention after approving <id>: <outcome>`, and the script prints it.

## Micropub

`POST /micropub` accepts form-encoded, multipart, or JSON `h-entry` and `h-event` bodies with a bearer
token. The token must be one this site's own token endpoint issued: it is
looked up in the `indieauth_tokens` table (see IndieAuth below), with no call
to another server, and must be unexpired, unrevoked, carry the scope the
request needs, and have a `me` on the canonical origin. A client may send one
token in the bearer header or form body. Missing and invalid tokens get 401; a
valid token without the scope gets 403 `insufficient_scope`. Two tokens get 400.

| Request                                    | Scope      | Answer                                                                |
| ------------------------------------------ | ---------- | --------------------------------------------------------------------- |
| `POST` an `h-entry`                        | `create`   | 202 with `Location`; the post is live after the deploy                |
| `POST` `action=update`                     | `update`   | 200 with `{ url, path, commit }`                                      |
| `POST` `action=delete`                     | `delete`   | 200 with `{ url, path, commit }`; the permalink 404s after the deploy |
| `POST` `action=undelete`                   | `undelete` | Restores the archived original source and permalink                   |
| `GET ?q=source&url=` (and `properties[]=`) | any        | the writing's mf2 JSON, drafts included                               |
| `GET ?q=config`, `?q=syndicate-to`         | none       | capabilities, syndication targets, and the `q` values it answers      |
| `GET ?q=category` (and `filter=`)          | none       | `{ categories }`, the tags of published writings                      |

In a JSON body, `in-reply-to`, `like-of`, `repost-of`, and `bookmark-of`
may each be a URL or an embedded `h-cite`. The post preserves the embedded h-cite and every supplied value. Rendering uses its
`url`, or its `value` when it has no `url`, and a citation that names neither
gets a 400 `invalid_request`.

An `mp-slug` becomes the file name and the permalink, so it may use only
letters, digits, hyphens, and underscores, and must start with a letter or
digit. Anything else, such as `../` or a leading `_`, gets a 400
`invalid_request` rather than a rewritten slug, so the client never publishes
at an address it did not ask for. `feed`, `opengraph-image`, and `tags` are
refused the same way, since a route already answers at each of them. Without
`mp-slug` the site makes a slug from the name or text, and a made slug that
lands on one of those names gets a timestamp suffix.

A valid request becomes an MDX file under `content/writings`. When
`MICROPUB_GITHUB_REPO` and `MICROPUB_GITHUB_TOKEN` are set the file is
committed through GitHub's Contents API on `MICROPUB_GITHUB_BRANCH` (default
`main`) so the post deploys like any hand-written one. Without those variables
the route writes into the local checkout. On a read-only deploy that write
fails with a 500 whose `error_description` names the reason, which is the
correct outcome on Vercel and Workers: set the GitHub variables there.

### Source queries

`?q=source&url=<permalink>` answers with the writing as
`{ "type": ["h-entry"], "properties": { ... } }`. It reads the file from the
same place a create writes it, the GitHub branch or the local checkout, so it
returns a post committed a minute ago that has not deployed yet. `title`
becomes `name`, `description` becomes `summary`, the original body becomes
`content` as literal text or an HTML object according to its source format, and `draft` becomes `post-status`. `published`
and `lastUpdated` come back as `published` and `updated` in UTC. `tags` come
back as `category` strings and `people` as `category` h-cards. `inReplyTo`,
`likeOf`, `repostOf`, `bookmarkOf`, and `rsvp` come back as `in-reply-to`,
`like-of`, `repost-of`, `bookmark-of`, and `rsvp`. `photo` and
`syndication` keep their names, and the permalink is `url`. Keys with no mf2
property, such as `series` and `featured`, are left out. With `properties[]=content` (or a single
`properties=content`) the answer holds only the named properties and no
`type`. A URL that is not a writing permalink on this origin, or names no
file, gets 400 `invalid_request`. The answer carries
`Cache-Control: no-store`.

### Category queries

`?q=category` answers `{ "categories": [...] }` with the tags of published
writings, lowercase and sorted, the same tags that have pages under
`/writings/tags` in production. `filter=tr` keeps the tags that start with
`tr`, ignoring case. It needs no token, so it leaves out tags that only
drafts carry, even on a development server that shows drafts.

### Updates

`action=update` names the permalink in `url` and changes it with any of
`replace`, `add`, and `delete`. The body is JSON as the spec defines it, or
form-encoded as `replace[name][]=…`, `add[category][]=…`,
`delete[category][]=…`, and `delete[]=photo`. `delete` takes a list of
property names to remove whole, or a map of values to remove. An update retains nested and multivalued properties, including audio, video, file attachments, locations, citations and syndication intent. Recognized fields update their page projections. Additional MF2 properties remain in the private source map without executing supplied code. Literal text renders literally; HTML content receives the same safe markup policy as approved replies. A URL that is not a writing gets the same 400 as `q=source`.

The route reads the file from storage and rewrites only the frontmatter keys
whose values change, plus the body when `content` changes. Every other byte
stays, including comments, key order, line endings, and keys Micropub does
not know, such as `series`. `lastUpdated` moves to the time of the request,
so a client cannot set `updated`. A draft stays a draft unless the update
replaces `post-status` with `published`, and `post-status` cannot be added
or deleted. An update that changes nothing answers 200 with an empty
`commit` and makes no commit. On GitHub the commit is
`chore(content): Update <slug> via Micropub`, and it carries the blob SHA
the route read, so an update that races another commit to the same file
fails with 409 instead of overwriting it. The change is live after the
deploy.

### Deletes

`action=delete` with the permalink in `url`, form-encoded or JSON, deletes
the writing's file. On GitHub that is a Contents API `DELETE` carrying the
blob SHA the route read, committed as
`chore(content): Delete <slug> via Micropub`, so a delete that races another
commit to the file fails with 409 instead of discarding that commit.
Without GitHub the route unlinks the file in the local checkout. After the
deploy the permalink answers 404, and the post leaves the lists, feeds,
sitemap, and search index, which the build makes from the files. With
`SEARCH_BACKEND=postgres` the search table keeps the post until
`/api/search/reindex` runs. Photos the post cited stay in Blob storage, and
webmentions stored for its URL stay in Postgres.

The private `micropub_deleted_writings` archive stores the exact source and permalink before removing the published file. `action=undelete` requires the `undelete` scope and restores that source at the original permalink. A conflicting file rejects restoration with 409. Transaction advisory locks serialize lifecycle operations across instances. The archive commits separately before an external file mutation; a failed operation may leave a recoverable archive. Deleted posts notify previous Webmention targets after deployment.

### Syndication

`?q=syndicate-to` and `?q=config` advertise only the configured Bluesky account when publishing credentials are available. Creation and updates retain explicit per-writing `mp-syndicate-to` intent. Standard publishing executes it after the document exists. [AT Protocol publishing](../atproto.md) describes duplicate prevention and copy associations. Manual Bluesky and Threads sharing remains available on writing pages.

### Media

`?q=config` advertises `/micropub/media` as the `media-endpoint` only when
the Vercel Blob connection supplies OIDC credentials or a legacy
`BLOB_READ_WRITE_TOKEN` configures storage. A client such as Quill uploads
each media file there first. The upload is the multipart
`file` part, and the token needs the `media` or the `create` scope. Supported images, audio, video and PDF files pass signature and 4MiB size checks. SVG receives 400. The
file is stored as a public blob in Vercel Blob under
`media/<year>/<month>/<name>-<random>.<ext>`, and the endpoint answers 201
with the blob's URL in `Location` (and as `url` in the JSON body). Without
either credential it answers 503.

The client then cites that URL in a JSON `photo` property. Each photo must be
`{ "value": url, "alt": text }` with nonblank alt text. Form `photo` and
`photo[]` values and bare JSON URLs receive 400 `invalid_request`. A post with
a photo becomes `postType: photo`,
and the caption may be empty. Each photo is written into the `photo`
frontmatter as `{ url, alt }` and renders under the date in
`WritingHeader.tsx` as a `u-photo`. A photo value that is not an http(s) URL
gets a 400 `invalid_request`. Multipart photo files sent directly to
`/micropub` receive 400 before any upload. Send files to `/micropub/media` first.
The build and pre-push checks apply the same nonblank alt rule to authored content.

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
older clients, every page repeats them in its HTTP `Link` header, and
WebFinger returns the same three links. All three render
`INDIEAUTH_DISCOVERY_LINKS` from `lib/indieweb/discovery-links.ts`, so they
cannot disagree.

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

The consent page is for the site owner. It presents the client and requested
access first, followed by owner verification and approval in one reading order.
The client address stays visible below its name. A native **Request details**
disclosure exposes the complete client, return, and identity URLs.

The route renders HTML outside the site's React layout. It uses the site's text
navigation, Material surface roles from `lib/theme.ts`, and variable Atkinson
faces from `public/fonts`. Update those public copies when the site's fonts
change.

New access tokens last one hour and refresh authorization expires after 90 days of inactivity. Existing access tokens retain their recorded expiry. The refresh and UserInfo section below describes client binding and replay revocation.

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
`/micropub` from servers and apps, which cannot pass a browser challenge.
So do the standard.site readers and validators that fetch
`/.well-known/site.standard.publication` and `/.well-known/atproto-did`,
and the post-deploy sync, which fetches `/writings/*/opengraph-image` and
`/brand/social/*` from the live site for the images on its records. If
Vercel's Bot Protection, Attack Challenge Mode, or a Firewall rule that
challenges is on, add a Firewall custom rule with the Bypass action, above
the challenging one, for requests whose path starts with `/indieauth/`,
`/micropub`, or `/brand/social/`, matches `/writings/*/opengraph-image`, or
equals `/.well-known/oauth-authorization-server`,
`/.well-known/site.standard.publication`, or `/.well-known/atproto-did`. The
same goes for any challenge Cloudflare puts in front of the site.

## Scripts

| Script                                   | What it does                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm search:index` (runs as `prebuild`) | Writes `public/search-index.json` and the Pagefind index in `public/pagefind/` from published writings and their tags, initiatives and their parts, and pages. Both are gitignored. The Pagefind step needs its platform binary, which the `pagefind` package installs.                                           |
| `pnpm websub:ping`                       | POSTs `hub.mode=publish` to `WEBSUB_HUB` for the six site and writings feeds, `/writings`, and each published tag's page and feeds.                                                                                                                                                                               |
| `pnpm webmentions:send`                  | Sends webmentions for writings whose content hash changed. Skips itself without a database.                                                                                                                                                                                                                       |
| `pnpm webmentions:moderate`              | Lists pending webmentions, or approves or rejects them by id; see Moderation. Approving a reply also sends its salmention; see Salmention. Needs `POSTGRES_URL`.                                                                                                                                                  |
| `pnpm webmentions:backfill-authors`      | One-off repair for webmentions verified before the verifier read a `u-photo` with alt text: fills each missing author photo from the h-entry stored with the mention, through `extractAuthor`. It writes only rows with no photo, so a second run changes nothing. Without `POSTGRES_URL` it says so and exits 0. |
| `pnpm atproto:sync`                      | Prints the standard.site writes a sync would make; `--write` makes them. Needs `ATPROTO_APP_PASSWORD`; see [atproto.md](../atproto.md).                                                                                                                                                                           |
| `pnpm indieauth:totp`                    | Prints a new secret for `INDIEAUTH_TOTP_SECRET` and the `otpauth://` URI to add to an authenticator app; see IndieAuth.                                                                                                                                                                                           |
| `.github/workflows/indieweb-publish.yml` | Waits for the public alias to serve a pushed revision, then calls the authenticated notification endpoint.                                                                                                                                                                                                        |
| `pnpm test`                              | `tsx --test tests/unit/*.test.mts`                                                                                                                                                                                                                                                                                |

## Environment variables

| Variable                                                                                           | Used by                                                                                                                                                                                     | Default                                 |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `POSTGRES_URL` / `DATABASE_URL`                                                                    | webmentions, reply context, activity feeds, Postgres search                                                                                                                                 | unset, features degrade                 |
| `WEBMENTION_SECRET`                                                                                | `/api/webmention/send*`                                                                                                                                                                     | unset, routes refuse                    |
| `WEBMENTION_MODERATION_SECRET`                                                                     | `/api/webmention/moderate`                                                                                                                                                                  | unset, route refuses                    |
| `INDIEAUTH_TOTP_SECRET`                                                                            | owner sign-in on `/indieauth/consent`                                                                                                                                                       | unset, sign-in answers 503              |
| `INDIEAUTH_INTROSPECTION_SECRET`                                                                   | `/indieauth/introspect`                                                                                                                                                                     | unset, route answers 503                |
| `MICROPUB_GITHUB_REPO`, `MICROPUB_GITHUB_TOKEN`, `MICROPUB_GITHUB_BRANCH`, `MICROPUB_CONTENT_PATH` | Micropub storage                                                                                                                                                                            | local write, `main`, `content/writings` |
| `BLOB_STORE_ID` with Vercel OIDC, or `BLOB_READ_WRITE_TOKEN`                                       | `/micropub/media` photo storage in Vercel Blob                                                                                                                                              | unset, route answers 503                |
| `SEARCH_BACKEND`                                                                                   | `postgres` switches search to Postgres                                                                                                                                                      | JSON index                              |
| `SEARCH_REINDEX_SECRET`                                                                            | `/api/search/reindex` in production                                                                                                                                                         | unset                                   |
| `INDIEWEB_NOTIFY_SECRET`                                                                           | authenticates the post-deployment notification endpoint                                                                                                                                     | unset, endpoint refuses                 |
| `SKIP_WEBMENTIONS`                                                                                 | `true` skips `webmentions:send`                                                                                                                                                             | unset                                   |
| `INDIEWEB_TEST_ALLOW_LOOPBACK`                                                                     | the local write test only: lets the public-only fetch reach loopback; ignored on Vercel                                                                                                     | unset                                   |
| `NEXT_PUBLIC_ATPROTO_DID`                                                                          | `/.well-known/atproto-did`, the Bluesky profile link and syndication target, and (with `ATPROTO_PUBLICATION_RKEY`) the `/.well-known/site.standard.publication` route and its `<link>` tags | unset, all off                          |
| `NEXT_PUBLIC_BLUESKY_HANDLE`                                                                       | the Bluesky account's displayed handle                                                                                                                                                      | unset, the DID is shown                 |
| `ATPROTO_PUBLICATION_RKEY`                                                                         | the standard.site publication: its record, `<link>` tags, and well-known route                                                                                                              | unset, all off                          |
| `ATPROTO_APP_PASSWORD`                                                                             | standard.site sync after each production deploy                                                                                                                                             | unset, sync skipped                     |

The Postgres schema starts with `lib/db/migrations/000_webmentions.sql`.
Apply it before `lib/db/migrations/001_level4_tables.sql`, which adds
`outgoing_webmentions`, `reply_context_cache`, and `search_index` and alters
the Webmention table. The route can also create its base Webmention table
through `initializeWebmentionsTable()`, but a fresh database must not rely on
a first request to prepare migrations.
`lib/db/migrations/002_webmention_rate_limits.sql` adds
`webmention_rate_limits`, which a database created before it needs; apply it
the same way. `lib/db/migrations/003_indieauth.sql` adds the IndieAuth
tables: `indieauth_codes` and `indieauth_tokens`, which hold SHA-256 digests
rather than the codes and tokens themselves, and `indieauth_totp_steps` and
`indieauth_sign_in_failures` for the owner check. Apply it before turning on
sign-in.
`lib/db/migrations/004_webmention_responses.sql` adds the `rsvp`,
`content_html`, and `vouch_url` columns to `webmentions` and the
`salmentions` table. Every webmention query names that column, so apply the
migration before deploying the code that reads it.

## IndieMark evidence

The [criteria and evidence record](indiemark.md) separates implemented code
from public proof. No level is claimed while production has no published
writings or actual syndicated copies.

## Not covered here

The IndieAuth server signs in one person, the site owner, and has no refresh
tokens or `userinfo` endpoint. Nothing federates over ActivityPub yet; that
plan is in `docs/future/activitypub.md`.

## Refresh and UserInfo

`/indieauth/token` accepts `grant_type=refresh_token`, `refresh_token`, and `client_id`. Rotation binds the credential to its original client and grant, rejects scope escalation, and atomically hashes and spends the old token. Reuse revokes the entire family. New access tokens last one hour. Each refresh starts a 90-day inactivity deadline. Existing access tokens keep their recorded expiry. `/indieauth/userinfo` returns identity and profile/email fields allowed by the token's scopes. Metadata advertises both capabilities. S256 PKCE remains mandatory.

Media uploads accept the MIME types in `MEDIA_TYPES` under `lib/indieweb/media.ts`. The limit is 4MiB. The endpoint checks file signatures and rejects SVG, empty files and mismatched types. Audio and video use native controls without autoplay; PDF files remain links. Signature checks recognize containers; they do not prove that a browser can decode every codec inside them.
