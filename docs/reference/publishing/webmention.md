# Webmention

Maintainers use this reference to inspect response verification, moderation, and delivery behavior. `/webmention` receives outside links; `/webmentions?target=` exposes approved responses. The [markup reference](microformats.md) defines how pages render them. Use the [HTTP guide](../../guides/publishing/indieweb-testing.md) to verify the endpoints.

## Moderation

### Approval and visibility

A received webmention is stored unapproved, and every page, feed, and
`/webmentions` query shows only verified, approved ones, so nothing appears
until Willie approves it or the [Vouch policy](#vouch) does.

Public pages and feeds share a one-hour R2 snapshot. Verified HTTP changes and
API moderation rotate its generation and invalidate the target page. The
snapshot query bypasses Hyperdrive's SELECT cache so its replacement sees the
committed change. Local script or direct database moderation cannot invalidate
the hosted snapshot; visibility may lag by up to one hour.

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
target, or has no `h-entry`, becomes a mention. The [markup reference](microformats.md)
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
   seconds apart. This bounded wait does not cover the one-hour public snapshot;
   local approval can return `not-shown` while that snapshot remains stale. Use
   authenticated HTTP moderation when prompt hosted visibility is required.
4. A writing sends at most one salmention every ten minutes, counted in the
   `salmentions` table. A reply approved inside that window reaches upstream
   with the next salmention after it, not on its own.

### Avoid notification loops

Only an approval starts a salmention; verifying a mention again never does. So
when an upstream site answers the salmention by pinging the writing, nothing is
sent back. Each outcome is logged as `Salmention after approving <id>:
<outcome>`, and the script prints it.

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
