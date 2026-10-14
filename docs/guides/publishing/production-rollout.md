# Production IndieWeb rollout

This is the September 23, 2026 rollout record. Its deployment and configuration
statements are historical. Use the
[current conformance matrix](../../reference/publishing/publishing-conformance.md)
for present release gates.

That rollout established the production services while keeping authored drafts
private. The
[isolated acceptance record](../../evidence/publishing/verification-2026-09-23-followup.md)
contains the tested URLs and outside responses;
[publication review](publication-review.md) covers the approval needed before an
original writing becomes public.

## Recorded deployment

### Resources observed on September 23

On September 23, 2026 PDT, the rollout created Neon project
`willie-page-indieweb-production` (`icy-sound-09771903`) in `aws-us-west-2`. At
that point, the database had the base Webmention table and migrations 001–003.

### Publishing credentials and outbound gate

The Vercel `website` project had its own public Blob store
`willie-page-indieweb-production`, production database URL, site origin,
IndieAuth owner secret, Webmention moderation and send secrets, and a
repository-scoped Micropub token. The token granted Contents write to
`WillieCubed/website` only, with a September 23, 2027 expiry. Vercel held the
production notification secret; GitHub did not yet have the matching secret, so
the production workflow skipped outbound sends pending public post checks. The
publishing branch was `main`.
[PR 111](https://github.com/WillieCubed/website/pull/111) deployed revision
`8dcede2` on September 23, 2026 PDT.

The migration range above describes the September database. Later publishing
changes applied additional migrations; use the current bootstrap reference when
preparing a database now.

## Recorded checks

### What isolated publication established

The isolated site proved that a Micropub note committed to its publishing
branch, deployed without a manual rebuild, appeared in the feed, and reached a
WebSub Rocks subscriber. Its media upload and moderated Webmention flows also
passed.

### What the production checks could establish

After deployment, seven read-only browser checks passed on `willie.page`; the
published-post case skipped because the feed had no items. The homepage,
writings page, all six feeds, Micropub configuration, IndieAuth metadata, search
route, and public Webmention JSON returned HTTP 200. `GET /micropub?q=config`
advertised the media endpoint and no false syndication destinations. All four
drafts still returned HTTP 404. The
[production RSS feed](https://willie.page/writings/feed.xml) advertised matching
WebSub hub and self URLs.

Production had no public writing to exercise, so those checks established
reachable endpoints and discovery metadata rather than a completed production
post lifecycle. The isolated site's subscriber receipt covered delivery in that
separate environment.

## Publication requirements

### Complete the public-content checks

At the September rollout, approved public posts were still needed to check
production permalinks, search results, rendered Webmentions, and the feed
contents. The rollout also left real outside reply and manual syndication checks
open, requiring exact outside permalinks in both directions. Its gate withheld
the level 3 claim and routine outbound notifications pending those checks. Later
October receipts record required production sync; the September gate does not
describe that later notification configuration.

### Enroll the owner before authenticated use

At the rollout, Willie still needed to enroll the production time-based
one-time-password (TOTP) secret in an authenticator before using the IndieAuth
consent screen. The rollout also deferred production Micropub test posts until
content review, because those posts would become public on `willie.page`.

Recheck these conditions against the
[current conformance reference](../../reference/publishing/publishing-conformance.md)
before acting. This section records why the rollout stopped where it did; it is
not authorization to publish a draft or a report that the historical gate is
still the current provider configuration.
