# Feeds

This page is for whoever adds a feed or a content type to one. Every feed is
a route handler that calls a generator in `lib/feeds/index.ts`; the generators
know nothing about routes, and the routes know nothing about XML. The site and
writings routes get their items from `lib/feeds/items.ts`, and the activity
routes get theirs through `lib/indieweb/activity-feed-route.ts`.

| Route                                                              | Format          | Items                                 |
| ------------------------------------------------------------------ | --------------- | ------------------------------------- |
| `/feed.xml`                                                        | RSS 2.0         | writings and initiatives              |
| `/feed/atom`                                                       | Atom 1.0        | writings and initiatives              |
| `/feed/json`                                                       | JSON Feed 1.1   | writings and initiatives              |
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

Feed readers that guess instead of reading those links land on the site feeds
too: `next.config.ts` permanently redirects `/rss.xml`, `/rss`, `/feed`, and
`/index.xml` to `/feed.xml`, and `/atom.xml` to `/feed/atom`.

## Full content

Every site and writings item carries its whole body as HTML: `content:encoded`
in RSS, `<content type="html">` in Atom, and `content_html` in JSON Feed, next
to the description as the summary. `renderFeedHtml` in `lib/feeds/html.ts`
renders the MDX body without React. Feed readers run no scripts and load no
site styles, so it turns each MDX component into plain HTML: a `Callout`
becomes an `<aside>`, a `Ref` a link, an image component a `<figure>`, and an
embed a link to what it embeds. Components that only work on the page, such
as `RouteMap` and `Gallery`, are dropped, and any component it does not know
keeps its children. Site-relative links and images become absolute. A new
MDX component that should survive into feeds needs a case in
`replaceComponent`.

## Adding a content type

Write a `<type>ToFeedItem` function next to `writingToFeedItem` and
`initiativeToFeedItem` in `lib/feeds/index.ts` that returns a `FeedItem`, then
load the items in `lib/feeds/items.ts` and add them to the list the routes
that should carry them read. The generators sort nothing; the loaders in
`lib/feeds/items.ts` sort items newest first.

Initiatives are dated by `starts`, or by `updated` when they have no start
date. An initiative with neither stays out of the feeds until it gets one.
Drafts stay out of every feed, as they do everywhere else.

Routes cache with `'use cache'` and `cacheLife('hours')`, so a new post shows
up in feeds within the hour after a deploy.
