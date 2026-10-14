# Feeds

Feeds let someone follow the site in a reader of their choice. RSS 2.0, Atom
1.0, and JSON Feed 1.1 offer the same content collections in different formats:
choosing Atom rather than RSS does not narrow a subscription to different work.

The route determines the collection. Site feeds combine published writings,
initiatives, and dated projects; writings and tag feeds offer narrower choices.
Activity feeds contain approved responses from other websites, called
Webmentions, rather than new articles.

In the implementation, `lib/feeds/items.ts` selects site and writings content,
`lib/feeds/index.ts` converts and serializes it, and the route handlers serve
the response. Activity uses `lib/indieweb/activity-feed-route.ts`. This
separation matters when extending a feed: selecting an item and expressing it as
RSS are different changes.

## Routes and discovery

| Route                                                              | Format             | Items                                               |
| ------------------------------------------------------------------ | ------------------ | --------------------------------------------------- |
| `/feed.xml`                                                        | RSS 2.0            | published dated writings, initiatives, and projects |
| `/feed/atom`                                                       | Atom 1.0           | published dated writings, initiatives, and projects |
| `/feed/json`                                                       | JSON Feed 1.1      | published dated writings, initiatives, and projects |
| `/writings/feed.xml`                                               | RSS 2.0            | writings                                            |
| `/writings/feed/atom`                                              | Atom 1.0           | writings                                            |
| `/writings/feed/json`                                              | JSON Feed 1.1      | writings                                            |
| `/writings/tags/[tag]/feed.xml`                                    | RSS 2.0            | writings carrying the tag                           |
| `/writings/tags/[tag]/feed/atom`                                   | Atom 1.0           | writings carrying the tag                           |
| `/writings/tags/[tag]/feed/json`                                   | JSON Feed 1.1      | writings carrying the tag                           |
| `/activity/feed.xml`, `/activity/feed/atom`, `/activity/feed/json` | RSS, Atom, JSON    | approved webmentions; requires Postgres             |
| `/writings/[slug]/activity/feed.*`                                 | same three formats | approved webmentions for one post                   |

### Links a reader can discover

The root layout advertises the three site feeds on every page.
`app/writings/page.tsx` advertises writings feeds through `alternates.types`,
and each tag page advertises its own three formats. A writing page advertises
its activity feeds and the oEmbed endpoint. Keeping these links beside the
relevant content lets a reader choose between all site updates, a topic, and
responses to one post.

Readers that guess conventional feed addresses also reach a supported route.
`next.config.ts` permanently redirects `/rss.xml`, `/rss`, `/feed`, and
`/index.xml` to `/feed.xml`, and `/atom.xml` to `/feed/atom`.

### WebSub topics and notifications

WebSub lets a hub tell subscribers that a topic has changed instead of making
them repeatedly fetch it. A topic is a subscribable URL, which can be a feed
document or an HTML page with feed markup.

Every feed declares `WEBSUB_HUB` from `lib/indieweb/constants.ts`: RSS and Atom
use `rel="hub"`; JSON Feed uses `hubs`. `/writings` and each tag page are also
h-feeds, HTML collections marked for feed readers. Their `<link rel="self">`
accompanies the root layout's `rel="hub"`, so the HTML page can be a
subscription topic too.

After deployment, `/api/indieweb/notify`, called by
`.github/workflows/indieweb-publish.yml`, and `pnpm websub:ping` notify the
topics from `publishedTopicPaths()` in `lib/indieweb/websub-publisher.ts`. Those
topics are the six site and writings feeds, `/writings`, and every published
tag's page and three feeds. The publisher does not track which posts changed, so
it sends every tag each time. Each tag therefore costs four sequential pings. A
few dozen tags would approach the notify route's 60-second limit; account for
that when expanding the topic set.

## Full content

A subscription should let someone read the post. Site and writings items carry
the body as HTML alongside the description used as a summary: `content:encoded`
in RSS, `<content type="html">` in Atom, and `content_html` in JSON Feed.

### Turning a page into portable HTML

`renderFeedHtml` in `lib/feeds/html.ts` renders MDX without React. Feed readers
run no site scripts and load no site styles, so the renderer preserves meaning
with ordinary elements. A `Callout` becomes an `<aside>`, a `Ref` becomes a
link, image components become `<figure>` elements, and an embed becomes a link
to its source. Site-relative links and images become absolute; a feed item may
be read on another host, where `/assets/...` would otherwise point at the wrong
server.

Page-only components such as `RouteMap` and `Gallery` are dropped. An unknown
component retains its children. That fallback keeps ordinary prose readable, but
cannot recover information held only in component props. When adding an MDX
component, review `replaceComponent` and give it a case if its meaning should
survive in feeds.

`StudioBlock` and `PortableBlock` use an explicit portable Markdown alternative.
For an interactive block, this alternative is the explanation a subscriber can
read when the interaction itself is unavailable. The decoder rejects blank
alternatives and executable MDX; write ordinary Markdown that carries the
block's essential content rather than a placeholder telling someone to visit the
site.

### Attachments and RSS enclosures

RSS carries one enclosure per item because conflicting enclosures can cause
readers to discard them. The generator prefers audio, then video, then an image,
then a linked file, and requires a known byte length. The writing-item loader
tries a HEAD request for attachment metadata; unavailable metadata can prevent
an RSS enclosure without removing the supported media from the full HTML. Atom
and JSON Feed retain every attachment.

## Adding a content type

A new content type needs a rule for which records belong in subscriptions and a
conversion from those records to `FeedItem`, the shared representation used by
all three formats. Keep publication rules in the loader and item converter so an
RSS subscriber receives the same eligible records as an Atom subscriber.

1. Add a `<type>ToFeedItem` function in `lib/feeds/index.ts`, alongside
   `writingToFeedItem`, `initiativeToFeedItem`, and `projectToFeedItem`.
2. Load eligible records in `lib/feeds/items.ts`, convert them, and add them to
   the collection used by the routes that should include the new type.
3. Preserve the newest-first order in the item loader. Generators do not sort.
4. Review the full HTML and attachments in all three formats; a correct title
   and URL do not establish that the body survived conversion.

### Publication dates and privacy

Initiatives use `starts`, falling back to `updated`. With neither date, an
initiative stays out of feeds. Published projects also require a real date;
facts-only projects supply neither private body text nor media. Drafts stay out
of every feed. These omissions avoid inventing chronology or allowing a feed to
expose material the page loader has withheld.

Routes use `'use cache'` with `cacheLife('hours')`. After deployment, cached
feed content follows that hourly cache policy; checking a feed immediately after
a change may still show the previous items.
