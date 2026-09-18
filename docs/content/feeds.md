# Feeds

This page is for whoever adds a feed or a content type to one. Every feed is
a route handler that calls a generator in `lib/feeds/index.ts`; the generators
know nothing about routes, and the routes know nothing about XML.

| Route                                                              | Format          | Items                                 |
| ------------------------------------------------------------------ | --------------- | ------------------------------------- |
| `/feed.xml`                                                        | RSS 2.0         | writings and projects                 |
| `/feed/atom`                                                       | Atom 1.0        | writings and projects                 |
| `/feed/json`                                                       | JSON Feed 1.1   | writings and projects                 |
| `/writings/feed.xml`                                               | RSS 2.0         | writings                              |
| `/writings/feed/atom`                                              | Atom 1.0        | writings                              |
| `/writings/feed/json`                                              | JSON Feed 1.1   | writings                              |
| `/activity/feed.xml`, `/activity/feed/atom`, `/activity/feed/json` | RSS, Atom, JSON | approved webmentions (needs Postgres) |
| `/writings/[slug]/activity/feed.*`                                 | same three      | approved webmentions for one post     |

Every feed declares `WEBSUB_HUB` from `lib/indieweb/constants.ts` as its hub:
RSS and Atom through a `rel="hub"` link and JSON Feed through `hubs`.
`pnpm websub:ping` tells the hub the six site and writings feeds changed, and
`scripts/postbuild.mts` runs it after a build when `INDIEWEB_POSTBUILD=1`.

The root layout advertises the three site feeds on every page, and
`app/writings/page.tsx` advertises the three writings feeds through
`alternates.types`. Each writing page advertises its own activity feeds and
the oEmbed endpoint.

## Adding a content type

Write a `<type>ToFeedItem` function next to `writingToFeedItem` in
`lib/feeds/index.ts` that returns a `FeedItem`, then include the items in the
route handlers that should carry them. The generators sort nothing; sort the
items by `published` before passing them in, as `app/feed/json/route.ts` does.

Routes cache with `'use cache'` and `cacheLife('hours')`, so a new post shows
up in feeds within the hour after a deploy.
