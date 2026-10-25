# Microformats

<a id="markup"></a>

Maintainers use this reference to preserve the machine-readable relationships in the rendered site. The markup describes the same authors, writings, collections, and responses that readers see. The [writing model](../content/writings.md) owns authoring fields; this page owns their HTML projections.

## Entries, author cards, and feed shells

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

## Post kinds and index projections

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

## Reply content and safe media

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

## Reactions and RSVP answers

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

## Mentions without a reaction

A source that links to the writing without replying or reacting appears as a
mention. Its `u-mention h-cite` carries the source's `u-url`, `dt-published`, and
`p-author h-card`.

The visible label comes from the citing entry. If its `p-name` supplies a title
separate from the text, the page shows that title; otherwise it shows the first
140 text characters as `p-content`. The title is read from the stored entry
rather than a separate database column. If the source supplies no author, the
page names its host instead of inventing a person.

## Keep responses inside the parsed entry

Response freshness and parser visibility are coupled here. A newer response
streamed outside the writing's `h-entry` would lose its relationship to that
writing for an upstream receiver.

The page reads Webmentions through the shared public snapshot. Verified HTTP
updates rotate its generation and invalidate the affected page; direct database
moderation can remain stale for its one-hour lifetime. The
[Webmention visibility contract](webmention.md#approval-and-visibility) owns that
policy. Keep responses inside the entry when changing how the page reads them.
`tests/unit/indieweb/webmention/webmention-display.test.mts` checks the rendered markup.

Author photos load directly from their sites without the local image optimizer. Initiative and part pages use
`components/indieweb/PageWebmentions.tsx` at the foot of the page. Those pages
have no surrounding `h-entry`, so their mentions remain standalone `h-cite`s.

## Initiative events and prose handles

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
