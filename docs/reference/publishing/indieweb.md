# IndieWeb

The site's IndieWeb support lets the owner publish through another client,
readers follow feeds, and outside posts send responses back to a permalink.
IndieAuth grants the owner's permission, Micropub changes the writing source,
and Webmention verifies a link from an outside response. These routes share the
site's identity but do different work.

Use this reference to look up endpoints, markup, configuration, and lifecycle
rules. [Independent publishing](../../concepts/publishing/independent-publishing.md)
explains how the pieces fit together; the [supported behavior contract](indieweb-spec.md)
defines their observable obligations. The [HTTP checks](../../guides/publishing/indieweb-testing.md)
cover verification, and [publication review](../../guides/publishing/publication-review.md)
applies before an authored draft becomes public.

Public identity comes from `lib/site/identity.ts`: canonical origin, author name, photo,
and social profiles. `lib/indieweb/constants.ts` names protocol endpoints and
the WebSub hub. An isolated deployment sets `NEXT_PUBLIC_SITE_ORIGIN` so its
identity and discovery links point to itself. A copied production hostname in a
route could send a test client to the wrong environment; keep the origin in the
shared configuration. Update the tables and run `pnpm test` when routes change.

## Routes

| Route                                                              | Purpose                                                                                                                | Needs                                                        |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `/webmention` (alias of `/api/webmention`)                         | Receives webmentions, verifies the source, stores them for moderation                                                  | Postgres                                                     |
| `/webmentions?target=`                                             | Public JSON list of approved webmentions for one page                                                                  | Postgres                                                     |
| `/api/webmention/moderate`                                         | `GET` lists pending webmentions; `POST` approves or rejects one; see Moderation                                        | Postgres, `WEBMENTION_MODERATION_SECRET`                     |
| `/activity/feed.xml`, `/activity/feed/atom`, `/activity/feed/json` | Site-wide feed of approved webmention activity; empty without a database                                               | Postgres (optional)                                          |
| `/writings/[slug]/activity/feed.*`                                 | Same three formats scoped to one writing                                                                               | Postgres (optional)                                          |
| `/micropub`                                                        | `GET ?q=config`, `?q=syndicate-to`, `?q=category`, `?q=source`; `POST` creates, updates, deletes and restores writings | IndieAuth token; see Micropub                                |
| `/micropub/media`                                                  | Micropub media endpoint; `POST` stores one image, audio, video or PDF file and answers 201 with its `Location`         | IndieAuth token, Cloudflare R2 media binding                 |
| `/.well-known/oauth-authorization-server`                          | IndieAuth server metadata; the head's `rel="indieauth-metadata"` points here                                           | nothing                                                      |
| `/indieauth/auth`                                                  | IndieAuth authorization endpoint; `GET` forwards to the consent page, `POST` redeems a code for the profile URL        | Postgres                                                     |
| `/indieauth/consent`                                               | The owner's consent page; approving needs a signed Cloudflare Access identity                                          | Postgres, owner Access configuration                         |
| `/indieauth/token`                                                 | Token endpoint; `POST` exchanges a code or rotates a refresh grant, `GET` with a bearer token verifies one             | Postgres                                                     |
| `/indieauth/userinfo`                                              | Permitted profile information for an active bearer token                                                               | Postgres                                                     |
| `/indieauth/introspect`, `/indieauth/revoke`                       | Token introspection (RFC 7662) and revocation (RFC 7009); see IndieAuth                                                | Postgres; `INDIEAUTH_INTROSPECTION_SECRET` for introspection |
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

The [conformance matrix](publishing-conformance.md) records inspected standards
and dated external release gates. Migrations 006 and 007 add rotating IndieAuth
refresh families and private Micropub deletion archives. Migration 009 binds
grants to spent authorization codes so replay revokes their access and refresh
tokens. Apply the migrations to acceptance before production, and apply 009
before deploying the code that calls its PostgreSQL functions.

## Markup

### Entries, author cards, and feed shells

Microformats2 (MF2) gives the visible HTML machine-readable meaning. Its class
names identify objects and their properties: `h-entry` marks a post, `h-card` a
person, and `h-feed` a collection. A parser can then associate a writing with its
URL, dates, and author without guessing from visual layout.

Each writing page is an `h-entry` containing `p-name`, `p-summary`, `e-content`,
`dt-published`, `dt-updated`, `p-category`, `u-url u-uid`, and a nested
`p-author h-card`. The top bar and document head also link home with
`rel="author"`. On the homepage, `components/home/Rail.tsx` provides the author's
representative `h-card`: the headline name is `p-name`, the line below is
`p-note`, and `<data class="u-photo">` and `<data class="u-email">` carry the
photo and email. These data elements describe the person without duplicating the
visible contact links in the footer. Footer profile links use `rel="me"` on
every page.

Collections have their own authorship. `/writings`, its tag pages, and
`/initiatives` are `h-feed`s with `p-name`, `u-url`, and a hidden
`p-author h-card` from `components/indieweb/FeedAuthor.tsx`. Entries can inherit
that author without repeating a visible byline. The writings index and tag pages
also advertise `<link rel="self">` beside the layout's `rel="hub"`; the publisher
pings those pages so a WebSub subscriber can follow the HTML feed itself.

Feed entries stay in the static shell. Streaming them through Suspense can place
them after `</main>`, leaving the collection empty for a parser. Each initiative
on `/initiatives` has its own `h-entry` with `p-name`, `u-url`, and `p-summary`.
Notes keep their visual form without a headline: the loader derives a title from
the first sentence for indexes and feeds, and `WritingHeader` puts it in an
`sr-only` heading.

### Post kinds and index projections

A reply or reaction describes a relationship to another post. The frontmatter
names that relationship, and `WritingHeader.tsx` and `ReplyTarget.tsx` render its
microformat property. `WritingContent.tsx` handles person tags. The
[writing model](../content/writings.md) describes the authoring fields.

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

The index must preserve those relationships too. `WritingItem.tsx` includes the
same kind properties in hidden markup on `/writings` and tag pages: the target
as `u-*-of h-cite`, an RSVP answer as `p-rsvp`, and each photo as `u-photo`.
Without them, a reader following the HTML index would see a summary but lose
which post a reply answers.

For posts without an explicit headline, the index exposes the whole body as
`e-content` even though the visible item shows only its first sentence. Articles
instead carry `p-summary` and leave the body to their permalink. The markup
therefore follows the kind of post rather than assuming every visible preview
is a complete entry.

### Reply content and safe media

An approved reply appears at the foot of the writing, inside its `h-entry`, as a
`p-comment h-cite`. The citation carries the reply's own `u-url`, `dt-published`,
text, and `p-author h-card`. That nesting lets another site read the reply as a
comment on this writing rather than as unrelated text after the article.

The source controls which content form the receiver starts with, but not what
code the page will execute. An `e-content` reply retains sanitized HTML;
`p-content` or summary input renders as plain `p-content`. The sanitizer in
`lib/indieweb/comment-content.ts` runs when content is stored and again when it
renders. It keeps prose, headings, lists, quotations, code, tables, figures,
images, audio, video, sources, caption tracks, valid text direction, and safe
media descriptions. It removes scripts, styles, executable embeds, event
handlers, autoplay, and attributes outside its explicit allowlist.

Links and media resolve against the reply URL using HTTP or HTTPS. Links receive
`rel="nofollow ugc"`, while file links retain `u-attachment`. Images load lazily;
audio and video use native controls with `preload="none"`. A reader can play a
reply's recording without the page starting it automatically.

Both text and HTML forms stop at 2,000 characters of text and end in “…” when
truncated. Storage keeps plain text in `content` for activity feeds, public JSON,
and moderation, and sanitized markup in `content_html`. Activity RSS escapes the
text again because readers interpret a description as HTML; Atom and JSON Feed
carry that value as text.

### Reactions and RSVP answers

Likes, reposts, bookmarks, and RSVPs appear as facepiles: grouped author images
with text naming the people who reacted. Each image belongs to a `u-like`,
`u-repost`, `u-bookmark`, or `u-rsvp` `h-cite` with an author card, so the visual
group also retains each response's identity.

An RSVP arrives as a reply whose entry carries `p-rsvp` with `yes`, `maybe`,
`interested`, or `no`, compared without regard to case. The receiver stores type
`rsvp` and the answer in its `rsvp` column; the rendered citation keeps the answer
as `p-rsvp`. The page groups answers in the order going, maybe, and interested.
A `no` remains in storage, activity feeds, and `/webmentions`, but the writing
page does not display it. Display omission therefore does not mean the response
was discarded.

Received RSVP markup has no single standard yet
([indieweb.org/rsvps](https://indieweb.org/rsvps)). The site uses `u-rsvp h-cite`,
a form used by other sites that also fits the neighboring reaction citations.

### Mentions without a reaction

A source that links to the writing without replying or reacting appears as a
mention. Its `u-mention h-cite` carries the source's `u-url`, `dt-published`, and
`p-author h-card`.

The visible label comes from the citing entry. If its `p-name` supplies a title
separate from the text, the page shows that title; otherwise it shows the first
140 text characters as `p-content`. The title is read from the stored entry
rather than a separate database column. If the source supplies no author, the
page names its host instead of inventing a person.

### Keep responses inside the parsed entry

Response freshness and parser visibility are coupled here. A newer response
streamed outside the writing's `h-entry` would lose its relationship to that
writing for an upstream receiver.

The page reads Webmentions through a `'use cache'` loader with
`cacheLife('minutes')`. Approval normally appears within about a minute without
a deploy, while the responses remain part of the entry. Do not replace that read
with request-time streaming without preserving the parsed structure.
`tests/unit/indieweb/webmention/webmention-display.test.mts` checks the rendered markup.

Author photos load directly from their sites because the image optimizer accepts
only the hosts listed in `next.config.ts`. Initiative and part pages use
`components/indieweb/PageWebmentions.tsx` at the foot of the page. Those pages
have no surrounding `h-entry`, so their mentions remain standalone `h-cite`s.

### Initiative events and prose handles

A trip part has event markup in its hero, not an article wrapper around the whole
page. `components/initiatives/PartEvent.tsx` renders an `h-event` whose `p-name`
is the standalone title from `partTitle()`, with `u-url`, `dt-start`, `dt-end`,
and the tagline as `p-summary`. Each place contributes a `p-location h-adr` with
`p-locality`, `p-region`, `p-latitude`, and `p-longitude`.

Mentions sit outside that hero and remain standalone citations. The JSON-LD graph
describes the same trip as a schema.org `Event` through `eventLd()` in
`lib/seo/jsonld.ts`; `tests/unit/initiatives/initiative-event.test.mts` checks the rendered
microformat.

Prose handles are a separate authoring convenience. `lib/writings/remark-mentions.ts`
turns `@handle` into a profile link. `@thewilliediaries` and `@williecubed` map
to their Instagram profiles, and other handles default to
`https://instagram.com/<handle>`. Add a `MENTION_TARGETS` entry when the intended
profile lives elsewhere. A handle link identifies a person; it does not by
itself create a reply or syndication relationship.

## Moderation

### Approval and visibility

A received webmention is stored unapproved, and every page, feed, and
`/webmentions` query shows only verified, approved ones, so nothing appears
until Willie approves it or a vouch does (see Vouch below).

Moderate from a terminal with the database URL in the environment:

```sh
pnpm webmentions:moderate
```

Choose one pending mention and replace `REPLACE_WITH_PENDING_UUID` with its ID
from that output. Review its source and target before approving it:

```sh
mention_id='REPLACE_WITH_PENDING_UUID'
pnpm webmentions:moderate approve "$mention_id"
```

To reject it instead, use `reject` in place of `approve`. These are alternative
decisions, not successive setup steps: approval exposes the verified mention,
while rejection hides it and keeps a resent mention from making it visible.

### Moderation endpoint and state changes

The HTTP alternative uses `Authorization: Bearer $WEBMENTION_MODERATION_SECRET`: `GET
/api/webmention/moderate` returns `{ count, pending }`, and `POST` with `{
"action": "approve" | "reject", "id": "<uuid>" }` applies one decision. Without
the secret the route answers 503; with a wrong one, 401. Placing this route behind Cloudflare Access, with the secret as a second
check, remains proposed work.

Only a verified mention can be approved; unverified ones are listed, marked
`(unverified)`, so they can be rejected. Rejecting sets `is_deleted`, the same
soft delete the verifier uses when a source goes away, so a resent mention from
that source stays hidden. Approving or rejecting an id that is not in a state to
change answers 404 from the route and exits 1 from the script. Moderation logic
and its tests live in `lib/indieweb/webmention/moderation.ts` and
`tests/unit/indieweb/webmention/webmention-moderation.test.mts`.

## Receiving

### Targets and canonical addresses

A target may be any page on the site that exists: the homepage, a routed page,
an initiative or one of its parts, or a published writing, which is the
sitemap's list. Anything else gets a 400. The target may name a legacy host such
as `www.willie.page` or an alias host such as `tour.willie.page`, because each
one redirects to the canonical origin. It is stored under its canonical address,
without a trailing slash, query, or fragment, so it matches the address the page
reads its mentions from. The verifier then resolves links against the fetched
page's final URL and valid HTML base URL. An absolute or relative link counts
when it resolves to the same target page on an allowed host. Distinct pages on
the same site may mention each other. Identical source and target URLs are
rejected. The logic and its tests live in `lib/indieweb/webmention/targets.ts`
and `tests/unit/indieweb/webmention/webmention-targets.test.mts`.

### Fetch an untrusted source

Anyone can name any source, so the verifier fetches it through
`fetchPublicDocument` in `lib/indieweb/public-fetch.ts`, the same guard the
IndieAuth client fetch uses. It reaches public addresses only, follows three
redirects at most and checks each hop, and gives up after 2 MB or ten seconds. A
source it refuses fails verification and stays unverified.

### Select the response and its author

A source page can contain several entries. The verifier classifies the entry
that actually cites the target, rather than taking the first reaction or author
on the page. Its matching property determines the response: `like-of` makes a
like, `repost-of` a repost, `bookmark-of` a bookmark, and `in-reply-to` a reply.
A reply with a `p-rsvp` answer becomes an RSVP. A page that only links to the
target, or has no `h-entry`, becomes a mention. The [markup section](#markup)
describes the resulting presentation.

Authorship follows the [authorship algorithm](https://indieweb.org/authorship-spec)
in `lib/indieweb/authorship.ts`. An embedded `p-author h-card` on the entry or
its parent `h-feed` supplies the author directly. A plain-text author supplies
only a name. When the author is a URL—or a permalink's `rel=author` supplies
one for an entry without an author—the verifier fetches that page.

On the author page, it first looks for an `h-card` whose `url` and `uid` both
identify the page itself. Next it considers a card whose `url` matches a
`rel=me` link on that page. If neither supplies the author, it looks on the
source page for a card whose `url` is the author page. The sequence avoids
mistaking any incidental person mentioned on a page for its representative author.

Author-page fetches use the public-address guard with a 1 MB and five-second
limit. They are not cached: each verification reads them again. If a named author
page supplies no usable card, the response retains its address without adding a
name the source did not establish.

### Acceptance, deferred verification, and rate limits

`POST /api/webmention` returns 202 after storing the request, then verifies its
source inside `after()` from `next/server`. That callback also checks a supplied
vouch and sends any Salmention started by a vouched reply. Storage acceptance is
not proof of verification, approval, or display.

The Worker first uses `WEBMENTION_EDGE_LIMIT` as a fast location-local guard.
PostgreSQL's `webmention_rate_limits` counter remains authoritative across
instances: each client address may send ten requests per minute, and expired
rows are pruned after accepted requests. Cloudflare requests use
`CF-Connecting-IP`; local requests retain the forwarded-address fallback.

A missing or failed edge limiter does not replace the database counter. If the
PostgreSQL counter itself fails, the request proceeds and logs the error; an
outage can still fail when the mention is stored. The policy and tests live in
`lib/indieweb/webmention/rate-limit.ts` and its unit test.

## Sending

A writing sends webmentions to the external links in its body, then to the posts
named by `inReplyTo`, `likeOf`, `repostOf`, `bookmarkOf`, and `rsvp.eventUrl`,
then to its tagged people. The deploy publisher (`pnpm webmentions:send` and the
notification endpoint) takes that list from `webmentionTargetsForWriting` in
`lib/indieweb/webmention/send.ts`, so a reply whose body never links its parent
still notifies the parent. The publisher hashes the list with the body, so
reordering it resends every post once.

## Vouch

A sender may add a `vouch` parameter
([indieweb.org/Vouch](https://indieweb.org/Vouch)): the address of a page, on a
domain this site trusts, that links to the sender's domain. A `vouch` that is
not an http(s) URL gets a 400. Without one, or when the check fails, the
webmention waits for moderation as before. After the source verifies,
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

A source that links to the writing but supplies an unusable vouch can still
verify successfully. It waits for ordinary moderation; a failed vouch does not
turn a genuine citing link into a false one. This keeps source verification and
automatic approval as separate decisions.

### Audit automatic approvals

Domains compare in lowercase, without a port or a leading `www.`. The vouch that
approved a mention is kept in `vouch_url`, and the outcome is logged as `Vouch
for <source>: <outcome>`. To see every automatic approval, run `SELECT
source_url, vouch_url FROM webmentions WHERE vouch_url IS NOT NULL`. To undo
one, reject its id as in Moderation.

### Why trust accepted deliveries

The Vouch specification permits trust in domains the receiver has linked to.
This implementation uses the narrower set of domains that have accepted this
site's Webmentions. Linking to a GitHub repository, for example, does not add
every GitHub page to the trusted set merely because the article cites it.

Trust still operates at domain granularity. On a multi-user host that accepts
Webmentions, such as micro.blog, any user's page can supply the qualifying vouch
link. The narrower rule does not establish individual trust within that host.

Only the deploy publisher writes the `outgoing_webmentions` history used for this
check. Until it has run, the site's own pages are the only eligible vouch source.

## Salmention

When a reply to a writing is approved, the writing resends its webmentions to
the posts it answers: its `inReplyTo`, `likeOf`, `repostOf`, `bookmarkOf`, and
`rsvp.eventUrl` ([indieweb.org/Salmention](https://indieweb.org/Salmention)).
The upstream receiver fetches the writing again and finds the new reply among
its comments. `sendSalmention` in `lib/indieweb/salmention.ts` runs after an
approval through `/api/webmention/moderate`, after a vouch approves a reply, and
after `pnpm webmentions:moderate approve`, which approves every id first and
then sends. It works like this:

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

### Avoid notification loops

Only an approval starts a salmention; verifying a mention again never does. So
when an upstream site answers the salmention by pinging the writing, nothing is
sent back. Each outcome is logged as `Salmention after approving <id>:
<outcome>`, and the script prints it.

## Micropub

### Authentication and request formats

`POST /micropub` accepts form-encoded, multipart, or JSON `h-entry` and
`h-event` bodies with a bearer token. The token must be one this site's own
token endpoint issued: it is looked up in the `indieauth_tokens` table (see
IndieAuth below), with no call to another server, and must be unexpired,
unrevoked, carry the scope the request needs, and have a `me` on the canonical
origin. A client may send one token in the bearer header or form body. Missing
and invalid tokens get 401; a valid token without the scope gets 403
`insufficient_scope`. Two tokens get 400.

| Request                                    | Scope               | Answer                                                                |
| ------------------------------------------ | ------------------- | --------------------------------------------------------------------- |
| `POST` a published `h-entry`               | `create`            | 202 with `Location`; public output follows publication/deployment     |
| `POST` with `post-status=draft`            | `create` or `draft` | 202 with a saved private revision; no public file fallback            |
| `POST` `action=update`                     | `update`            | 200 with `{ url, path, commit }`                                      |
| `POST` `action=delete`                     | `delete`            | 200 with `{ url, path, commit }`; see backend-specific deletion below |
| `POST` `action=undelete`                   | `undelete`          | Restores the archived original source and permalink                   |
| `GET ?q=source&url=` (and `properties[]=`) | any                 | the writing's mf2 JSON, drafts included                               |
| `GET ?q=config`, `?q=syndicate-to`         | none                | capabilities, syndication targets, and the `q` values it answers      |
| `GET ?q=category` (and `filter=`)          | none                | `{ categories }`, the tags of published writings                      |

### Creation, citations, and stable slugs

In a JSON body, `in-reply-to`, `like-of`, `repost-of`, and `bookmark-of` may
each be a URL or an embedded `h-cite`. The post preserves the embedded h-cite
and every supplied value. Rendering uses its `url`, or its `value` when it has
no `url`, and a citation that names neither gets a 400 `invalid_request`.

An `mp-slug` becomes the file name and the permalink, so it may use only
letters, digits, hyphens, and underscores, and must start with a letter or
digit. Anything else, such as `../` or a leading `_`, gets a 400
`invalid_request` rather than a rewritten slug, so the client never publishes at
an address it did not ask for. `feed`, `opengraph-image`, and `tags` are refused
the same way, since a route already answers at each of them. Without `mp-slug`
the site makes a slug from the name or text, and a made slug that lands on one
of those names gets a timestamp suffix.

For example, an explicit `mp-slug=tea-break` requests `/writings/tea-break`.
An explicit `mp-slug=tags` is rejected because `/writings/tags` already belongs
to routing. Quietly changing the second request to a different slug would make
the client lose control of the address it asked to publish.

### Choose the source store

A draft and a published file have different storage boundaries. Creation with
`post-status=draft` always saves a durable private Studio revision. It requires
private storage; absence returns 503 rather than committing draft text to GitHub
or writing it into `content/writings`. The 202 response includes the saved
revision and intended permalink, not a promise that the permalink is public.

Source reads prefer a private Studio document with the matching slug. Updating
that document saves another revision with a compare-and-swap against its previous
head. Publishing a selected revision uses the Studio publication path, including
its protected GitHub review/merge and deployment checks. Willie must approve an
authored writing's exact text and dates before that public operation.

Existing published files retain the compatibility backend. With
`STUDIO_GITHUB_REPOSITORY` and `STUDIO_GITHUB_TOKEN`, the endpoint uses GitHub's
Contents API on `STUDIO_GITHUB_BRANCH` (default `main`); without them it writes
to a writable local checkout. Those fallbacks serve public files, never private
drafts. A read-only hosted checkout needs the configured publication backend.
An accepted source change must still be followed through to the deployed public
permalink before claiming publication.

### Source queries

A source query lets an editor retrieve the data it would change, including a
draft. `?q=source&url=<permalink>` returns
`{ "type": ["h-entry"], "properties": { ... } }` from private Studio source when a matching document exists, otherwise from the
configured GitHub branch or local public file. It can therefore describe a saved
revision or commit that the public deployment does not yet serve.

The mapping preserves the writing's authoring form. `title` becomes `name`,
`description` becomes `summary`, and the original body becomes `content` as
literal text or an HTML object according to its source format. `draft` becomes
`post-status`; `published` and `lastUpdated` return as `published` and `updated`
in UTC. Tags return as `category` strings, while person tags return as category
`h-card`s.

Relationship fields return as their corresponding MF2 properties:
`inReplyTo`, `likeOf`, `repostOf`, `bookmarkOf`, and `rsvp` become
`in-reply-to`, `like-of`, `repost-of`, `bookmark-of`, and `rsvp`. `photo` and
`syndication` keep their names, and `url` is the permalink. Keys without an MF2
property, such as `series` and `featured`, are omitted from the response, not
deleted from the source file.

`properties[]=content` (or `properties=content`) filters the response to the
requested properties and omits `type`. A URL outside this origin's writing
permalinks, or one without saved source, returns 400 `invalid_request`. The
response uses `Cache-Control: no-store` because it includes authenticated source
state rather than only deployed public content.

### Category queries

`?q=category` answers `{ "categories": [...] }` with the tags of published
writings, lowercase and sorted, the same tags that have pages under
`/writings/tags` in production. `filter=tr` keeps the tags that start with `tr`,
ignoring case.

This query needs no token, so it leaves out tags that only drafts carry,
even on a development server that shows drafts.

### Updates

An update names the writing's permalink in `url` and changes properties through
`replace`, `add`, and `delete`. JSON follows the Micropub property grammar;
forms use names such as `replace[name][]=…`, `add[category][]=…`,
`delete[category][]=…`, and `delete[]=photo`. A deletion can name whole
properties or individual values.

Nested and multivalued MF2 properties—including media, locations, citations, and
syndication intent—remain in the source model. Recognized fields feed page
rendering. Additional properties are retained as data rather than executed code;
literal text stays literal, and HTML follows the safe markup policy.

#### Preserve edits and reject races

For an existing public source file, the compatibility updater rewrites changed
frontmatter and body fields while preserving unrelated bytes such as comments
and formatting. Its GitHub write carries the previously read blob SHA, so a
concurrent edit returns 409 instead of being overwritten. A no-op creates no
commit. The update sets `lastUpdated` to request time rather than accepting a
client-supplied `updated` value.

Private source uses saved Studio revisions instead of a byte-preserving file
edit. A matching document is updated against its previous revision ID; an
intervening save rejects the stale edit. A draft remains private unless an update
explicitly replaces `post-status` with `published`. That transition invokes the
publication path, not a local file fallback. Ordinary edits must not clear the
draft state or bypass publication approval. Saving a draft revision of a previously
published writing does not retract its already exported public revision.

### Deletes

Deletion follows the source backend. An existing public file is archived exactly
in `micropub_deleted_writings` before it is removed through GitHub or the local
checkout. GitHub deletion uses the read blob SHA and rejects a conflicting edit
with 409. Once deployed, the removed file leaves public lists, feeds, sitemap,
and search. Referenced R2 objects, older external media, and stored Webmentions
are not removed by deleting the writing.

#### Archive before removal

The public archive commits before the external file mutation so a failed delete
can leave a recoverable source. `action=undelete` requires `undelete` scope and
restores that archived source at its original permalink, rejecting collisions.
Transaction advisory locks serialize the public lifecycle operations. Deleted
public posts notify previous Webmention targets after deployment.

A private Studio document instead uses the store's revision-checked removal.
Its immutable source revisions do not enter the public Micropub deletion archive,
and that archive's `undelete` path is not a private-document restore operation.
Removing the private document does not itself remove an already exported public
file; inspect that public source separately before claiming the permalink is gone.
A legacy draft file must be imported into private storage before deletion; the
handler returns 503 rather than archiving that draft in the public store.

### Syndication

`?q=syndicate-to` and `?q=config` advertise only the configured Bluesky account
when publishing credentials are available. Creation and updates retain explicit
per-writing `mp-syndicate-to` intent. Standard publishing executes it after the
document exists. [AT Protocol publishing](atproto.md) describes duplicate
prevention and copy associations. Manual Bluesky and Threads sharing remains
available on writing pages.

### Media

A configured `MEDIA_BUCKET` R2 binding makes `/micropub/media` appear as the
`media-endpoint` in `q=config`. The client uploads one multipart `file` first,
using a token with `media` or `create` scope. The endpoint checks supported type,
byte signature, and the 4 MiB limit; SVG is rejected.

The object lives in a private R2 bucket under
`media/<year>/<month>/<name>-<random>.<ext>`, but the returned URL is public site
media served through `/media/*`. The endpoint returns 201 with that URL in
`Location` and JSON `url`; without the binding it returns 503. Private bucket
access is distinct from public delivery: saving a writing as a private draft
does not make a separately uploaded Micropub media URL private.

#### Photo descriptions and placement

Each JSON `photo` must be `{ "value": url, "alt": text }` with nonblank alt text.
Bare JSON URLs and form `photo`/`photo[]` values return 400 `invalid_request`.
The source stores `{ url, alt }`, and a photo post can have an empty caption.
Inline authored photos keep their position and `u-photo`; the header renders
only photos absent from the body so it does not repeat them.

Only HTTP/HTTPS photo URLs are accepted. Direct multipart photo creation at
`/micropub` returns 400 before uploading; send files to `/micropub/media` first.
Build and pre-push checks enforce nonblank authored alt text too.

#### Validation and playback limits

`MEDIA_TYPES` in `lib/indieweb/media.ts` defines accepted image, audio, video,
and PDF types. Empty files, SVG, mismatched signatures, and files above 4 MiB
are rejected. Audio/video use native controls without autoplay; PDFs remain
links. Container recognition does not establish that a browser decodes every
codec inside it.

#### Storage and existing URLs

The route uses the `MediaStore` interface; `getMediaStore()` selects the Worker
R2 binding. New uploads receive site URLs. Older external URLs remain as authored
unless a separate media migration changes those references.

## IndieAuth

### Identity discovery

The site is its own IndieAuth server
([indieauth.spec.indieweb.org](https://indieauth.spec.indieweb.org/)), so
signing in to a Micropub client as `https://willie.page/` never leaves this
domain. Clients find it through `<link rel="indieauth-metadata">` in the head,
which points at `/.well-known/oauth-authorization-server`. The head also keeps
`rel="authorization_endpoint"` and `rel="token_endpoint"` for older clients,
every page repeats them in its HTTP `Link` header, and WebFinger returns the
same three links. All three render `INDIEAUTH_DISCOVERY_LINKS` from
`lib/indieweb/discovery-links.ts`, so they cannot disagree.

### Authorization and single-use codes

The publishing client starts authorization in the owner's browser. PKCE binds
the later code exchange to the client that initiated it: the request carries an
S256 challenge, and redemption must supply its matching verifier. The site
requires S256 and `state`; it refuses the `plain` challenge method.

1. The client sends the browser to `/indieauth/auth` with `client_id`,
   `redirect_uri`, `state`, `code_challenge`, and the requested scopes.
2. The endpoint forwards to `/indieauth/consent`, which validates the client
   and return address. The redirect must use the client's scheme, host, and port,
   or appear in its registered metadata.
3. Cloudflare Access verifies the owner before the consent page presents the
   client and scope checkboxes. Willie approves the scopes left checked. The
   client receives a code with `state` and `iss`; denial returns
   `error=access_denied`.
4. The client redeems the code with `code_verifier`: `/indieauth/token` issues
   an access token, while `/indieauth/auth` returns the profile URL alone. A code
   lasts ten minutes and is spent on its first redemption attempt, valid or not.
   A code issued without scopes redeems only at `/indieauth/auth`.

Client metadata can be JSON whose `client_id` is its own URL and whose
`redirect_uris` lists permitted return addresses, or HTML with
`<link rel="redirect_uri">`. Its JSON `client_name` or HTML `h-app` supplies the
name shown to Willie. An invalid `client_id` or `redirect_uri` is shown to the
owner; other request errors return to the client.

Metadata retrieval is itself an untrusted fetch. The server checks every resolved
address when connecting to stop DNS rebinding, follows at most three redirects
with checks at each hop, and caps the response at 1 MB. It never fetches a
`localhost` client and uses defaults instead. These restrictions apply before
owner approval: anyone can initiate the metadata request.

### Consent presentation

The consent page is for the site owner. It presents the client and requested
access first, with the Access-verified owner deciding approval in the form.
The client address stays visible below its name. A native **Request details**
disclosure exposes the complete client, return, and identity URLs.

The route renders HTML outside the site's React layout. It uses the site's text
navigation, Material surface roles from `lib/theme/tokens.ts`, and variable Atkinson
faces from `public/fonts`. Update those public copies when the site's fonts
change.

### Token endpoints and operator inspection

New access tokens last one hour and refresh authorization expires after 90 days
of inactivity. Existing access tokens retain their recorded expiry. The refresh
and UserInfo section below describes client binding and replay revocation.

| Endpoint                                   | Answers                                                                                                                   |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `POST /indieauth/token`                    | `{ access_token, token_type, scope, me, expires_in, profile? }`, or revokes with `action=revoke&token=` for older clients |
| `GET /indieauth/token` with a bearer token | `{ me, client_id, scope }`, or 401 for a token that is not active                                                         |
| `POST /indieauth/introspect` with `token=` | `{ active, me, client_id, scope, iat, exp }`; needs `Authorization: Bearer $INDIEAUTH_INTROSPECTION_SECRET`               |
| `POST /indieauth/revoke` with `token=`     | 200 whether or not the token existed                                                                                      |

To see or cut off what is signed in, query the table: `SELECT client_id, scope,
issued_at FROM indieauth_tokens WHERE revoked_at IS NULL`, and set `revoked_at =
NOW()` on a row to revoke it. The protocol logic lives in
`lib/indieweb/indieauth/server.ts`, the HTTP handlers in
`lib/indieweb/indieauth/endpoints.ts`, and their tests in
`tests/unit/indieweb/indieauth/*.test.mts`.

### Owner sign-in

Cloudflare Access protects `/indieauth/consent` on the canonical hostname. The
Worker independently verifies `Cf-Access-Jwt-Assertion` against the configured
signing keys, issuer, audience, expiry, and owner email. A direct Worker URL
therefore cannot bypass owner verification merely by avoiding the Access edge.

Configure `OWNER_ACCESS_ISSUER`, `OWNER_ACCESS_AUDIENCE`, and
`OWNER_ACCESS_EMAIL` for the intended Worker. `lib/owner/access.ts` supplies the
shared authenticator, so the form asks which client scopes to approve rather
than requesting a TOTP code. The removed TOTP setup command
and earlier enrollment records do not describe current owner sign-in.

External clients need the other IndieAuth endpoints to remain public. Protecting
the whole protocol behind owner-browser Access would prevent those clients from
exchanging and verifying tokens. The consent POST also checks `Sec-Fetch-Site`,
then `Origin`, and refuses a request with neither header.

### Bot challenges

A machine client cannot complete a browser challenge just because an ordinary
browser can open the homepage. Before enabling a Cloudflare WAF or bot challenge,
keep the protocol endpoints reachable by their intended clients and verify that
path independently of owner-browser sign-in.

The affected paths include `/indieauth/`, `/micropub`,
`/.well-known/oauth-authorization-server`,
`/.well-known/site.standard.publication`, and `/.well-known/atproto-did`.
The publisher also fetches `/writings/*/opengraph-image` and `/brand/social/*`
from the live site for record images. Challenge exceptions for those machine
requests do not remove the signed owner check on `/indieauth/consent` or authorize
making the private preview public.

## Scripts

Select the intended environment before invoking a sender or writer. The table is
a command lookup, not a setup sequence. `atproto:sync` previews unless `--write`
is supplied; moderation approvals and notification commands can change stored
state or deliver to other sites.

| Script                                   | What it does                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm search:index` (runs as `prebuild`) | Writes `public/search-index.json` and the Pagefind index in `public/pagefind/` from published writings and their tags, initiatives and their parts, and pages. Both are gitignored. The Pagefind step needs its platform binary, which the `pagefind` package installs.                                           |
| `pnpm websub:ping`                       | POSTs `hub.mode=publish` to `WEBSUB_HUB` for the six site and writings feeds, `/writings`, and each published tag's page and feeds.                                                                                                                                                                               |
| `pnpm webmentions:send`                  | Sends webmentions for writings whose content hash changed. Skips itself without a database.                                                                                                                                                                                                                       |
| `pnpm webmentions:moderate`              | Lists pending webmentions, or approves or rejects them by id; see Moderation. Approving a reply also sends its salmention; see Salmention. Needs `POSTGRES_URL`.                                                                                                                                                  |
| `pnpm webmentions:backfill-authors`      | One-off repair for webmentions verified before the verifier read a `u-photo` with alt text: fills each missing author photo from the h-entry stored with the mention, through `extractAuthor`. It writes only rows with no photo, so a second run changes nothing. Without `POSTGRES_URL` it says so and exits 0. |
| `pnpm atproto:sync`                      | Prints the standard.site writes a sync would make; `--write` makes them. Needs `ATPROTO_APP_PASSWORD`; see [atproto.md](atproto.md).                                                                                                                                                                              |
| `.github/workflows/indieweb-publish.yml` | Waits for the public alias to serve a pushed revision, then calls the authenticated notification endpoint.                                                                                                                                                                                                        |
| `pnpm test`                              | `tsx --test 'tests/unit/**/*.test.mts'`                                                                                                                                                                                                                                                                           |

## Environment variables and bindings

| Variable                                                                                           | Used by                                                                                                                                                                                     | Default                                 |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `POSTGRES_URL` / `DATABASE_URL`                                                                    | webmentions, reply context, activity feeds, Postgres search                                                                                                                                 | unset, features degrade                 |
| `WEBMENTION_MODERATION_SECRET`                                                                     | `/api/webmention/moderate`                                                                                                                                                                  | unset, route refuses                    |
| `OWNER_ACCESS_ISSUER`, `OWNER_ACCESS_AUDIENCE`, `OWNER_ACCESS_EMAIL`                               | owner identity on `/indieauth/consent` and `/admin/*`                                                                                                                                       | unset, owner routes refuse access       |
| `INDIEAUTH_INTROSPECTION_SECRET`                                                                   | `/indieauth/introspect`                                                                                                                                                                     | unset, route answers 503                |
| `STUDIO_GITHUB_REPOSITORY`, `STUDIO_GITHUB_TOKEN`, `STUDIO_GITHUB_BRANCH`, `MICROPUB_CONTENT_PATH` | Micropub and Studio publication                                                                                                                                                             | local write, `main`, `content/writings` |
| `MEDIA_BUCKET` R2 binding                                                                          | `/micropub/media` image, audio, video and PDF storage; `/media/*` delivery                                                                                                                  | absent, upload route answers 503        |
| `INDIEWEB_NOTIFY_SECRET`                                                                           | authenticates the post-deployment notification endpoint                                                                                                                                     | unset, endpoint refuses                 |
| `SKIP_WEBMENTIONS`                                                                                 | `true` skips `webmentions:send`                                                                                                                                                             | unset                                   |
| `INDIEWEB_TEST_ALLOW_LOOPBACK`                                                                     | the local write test only: lets the public-only fetch reach loopback; ignored on Cloudflare                                                                                                 | unset                                   |
| `NEXT_PUBLIC_ATPROTO_DID`                                                                          | `/.well-known/atproto-did`, the Bluesky profile link and syndication target, and (with `ATPROTO_PUBLICATION_RKEY`) the `/.well-known/site.standard.publication` route and its `<link>` tags | unset, all off                          |
| `NEXT_PUBLIC_BLUESKY_HANDLE`                                                                       | the Bluesky account's displayed handle                                                                                                                                                      | unset, the DID is shown                 |
| `ATPROTO_PUBLICATION_RKEY`                                                                         | the standard.site publication: its record, `<link>` tags, and well-known route                                                                                                              | unset, all off                          |
| `ATPROTO_APP_PASSWORD`                                                                             | standard.site sync after each production deploy                                                                                                                                             | unset, sync skipped                     |

Hosted database access also requires `HYPERDRIVE` for public publishing state and
`STUDIO_HYPERDRIVE` for private drafts. Outside Workers, the corresponding direct
URLs are `POSTGRES_URL`/`DATABASE_URL` and `STUDIO_DATABASE_URL`. Keep these stores
separate when preparing local checks. `cloudflare.config.ts` declares the Worker
bindings; its modes select the production and preview resources.

### Migration ordering

The Postgres schema starts with `lib/db/migrations/000_webmentions.sql`.
Apply it before `lib/db/migrations/001_level4_tables.sql`, which adds
`outgoing_webmentions`, `reply_context_cache`, and `search_index` and alters
the Webmention table. No route creates tables, so a fresh database needs these
migrations before its first request.
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

Private Studio schema is separate from the public IndieWeb migration sequence.
Use the [private writing guide](../../guides/publishing/private-writing.md) and
its actual migration inventory when preparing draft storage; applying only the
Webmention/auth tables does not configure private revisions.

## IndieMark evidence

The [criteria and evidence record](indiemark.md) separates implemented code from
public proof. No level is claimed while production has no published writings or
actual syndicated copies.

## Not covered here

The IndieAuth server authorizes the site owner. AT Protocol visitor
authorization uses a separate OAuth client. ActivityPub delivery remains outside
this implementation; its proposal is in
`docs/concepts/publishing/activitypub.md`.

## Refresh and UserInfo

### Refresh families and scope

An access token authorizes requests for a limited time. A refresh token lets its
client obtain replacement credentials without sending the owner through consent
again. `/indieauth/token` accepts `grant_type=refresh_token`, `refresh_token`,
and `client_id` for that exchange.

Each successful refresh hashes and spends the old credential atomically and
issues the next one in the same authorization family. The family stays bound to
its original client and permitted scopes; rotation rejects escalation. Reusing
a spent refresh credential revokes the whole family rather than treating it as
a second successful refresh.

New access tokens last one hour. Each refresh starts a 90-day inactivity deadline;
legacy access tokens keep their recorded expiry. `/indieauth/userinfo` returns
identity and only the profile/email fields permitted by the active token's
scopes. Server metadata advertises refresh and UserInfo. These additions do not
remove the S256 PKCE requirement for initial authorization.

### Identity-only grants and code replay

A scope-free code returns only the profile URL and never creates access or
refresh credentials.

Reusing an authorization code revokes every token in its grant. Migration 009
serializes replay and token issuance on the code row. The server retains spent
code digests to preserve that association across refreshes. It removes only
expired unused codes. Existing grants without an association and legacy access
tokens retain their recorded expiry.

## Outgoing delivery retries

The publisher sends changed writings after deployment. It retains outgoing
history and skips unchanged successful deliveries, confirmed missing endpoints
and terminal HTTP 4xx rejections. HTTP 408, 425 and 429 remain retryable, as do
server errors and failed endpoint discovery. Changing the writing retries its
targets. An operator can reset a delivery to pending to request an explicit
retry.

### Distinguish absence from failure

A missing endpoint and an unreachable endpoint call for different decisions.
Treating a timeout as proof that a site does not support Webmention would silently
drop a delivery that could succeed later.

A successfully fetched public page without a Webmention endpoint counts as
unsupported. A network failure or failed HTTP fetch does not establish absence.
The notification fails on attempted delivery errors and required publishing
failures; it does not fail because an ordinary external link has no endpoint.
