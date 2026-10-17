# Links and hover cards

Use `SiteLink` for links in components, pages, and MDX, with the raw-anchor
exceptions below. It gives destinations a shared navigation behavior and adds
context to in-site prose links without making that context a prerequisite for
following them. The [design principles](../../concepts/design/design-principles.md)
explain how this supports approachable, honest interactions.

Run `pnpm lint` after changing links. It rejects `next/link` imports and raw
in-site anchors in `app/` and `components/` outside `components/link/`, subject
to the scope and source-analysis limits below.

## The rule

### One component classifies the destination

Every link on the site goes through `SiteLink` from
`components/link/SiteLink.tsx`, except the defined raw-anchor cases. In-site
page destinations get client-side navigation and, by default, a small card on
hover or keyboard focus describing the destination. External destinations
render as plain anchors, with `rel="noopener"` by default and no card. Hash
links never get a card.

`isInternalHref()` in `lib/site/urls.ts` determines whether the destination is on
the canonical origin. It accepts site paths beginning with `/` and absolute
HTTP(S) URLs only when URL parsing resolves them to that origin. A spelling
prefix is insufficient: `https://willie.page.evil.com` and `//other.example`
leave the site. Centralizing this decision keeps navigation and preview
behavior aligned with where the browser will actually go.

MDX prose receives `SiteLink` through the `a` override in
`components/mdx/index.tsx`, which replaces the anchor rendered for a Markdown
link. Authors can therefore write ordinary Markdown links. When writing a page
or component in JSX, import `SiteLink` directly, as in these three cases: an
inline initiative link, an existing card that needs no second preview, and an
external studio link.

```tsx
import SiteLink from '@/components/link/SiteLink';

<SiteLink href="/initiatives/twd">The Willie Diaries</SiteLink>
<SiteLink href="/writings/project-superbloom" preview={false} className="card">…</SiteLink>
<SiteLink href="https://hypertext.studio">Hypertext Studio</SiteLink>
```

### Event handlers compose with the shared behavior

A component may need to respond to focus or a press while still using the link's
preview. For the events it handles, including `onPointerDown` and `onFocus`,
`SiteLink` calls your handler before its own. Supplying one therefore adds to
the behavior instead of replacing the code that opens or dismisses the card.

Click interception is a separate choice. An `onClick` handler can call
`event.preventDefault()` to stop navigation; homepage tiles do this to open
a detail view in place. Keep the destination in the href and keep using
`SiteLink`. The click handler supplies the enhanced view, while ordinary
navigation still has an address to follow when that handler does not run.

## What lint checks

### Imports and literal destinations

`no-restricted-imports` rejects direct `next/link` imports outside the shared
link implementation. The local `site/no-raw-internal-anchor` rule in
`eslint/no-raw-internal-anchor.mjs` checks JSX anchors whose href can be read
from their source syntax.

The raw-anchor rule recognizes strings or template-literal prefixes starting
with `/` or `?`, and the canonical `https://willie.page` spelling at an origin
boundary. It excludes protocol-relative `//host` URLs and lookalike hosts such
as `https://willie.page.evil.com`. It also recognizes `site.origin` and
template literals beginning with that expression. These checks identify likely
in-site destinations without treating every similarly spelled host as this
site.

Both rules apply to `app/` and `components/` outside `components/link/`.
Links elsewhere still follow this document's rule; those locations are outside
the lint check's scope.

### Computed hrefs still need review

The source rule cannot follow a value such as `{link.href}` or
`{absoluteUrl('/writings')}` to discover its destination. Check those links
manually. The same `SiteLink` requirement applies, even when lint cannot
recognize the address.

For a computed href, find where its value comes from and check the rendered
destination. A variable may hold an external address in one use and an in-site
page in another; routing both through `SiteLink` lets its URL classification
choose the appropriate behavior.

## When a raw anchor is right

### Destinations that are not routed pages

Route handlers require a full navigation because the router cannot render
their response as a page. This includes `/coffee` and `/tea` through `BrewLink`,
the footer's 418 tagline pointing to `/coffee`, and the feeds exposed by the
footer's feeds button. The response itself is the destination, whether it is
a teapot joke or a feed document.

Downloads also use raw anchors: the brand kit files on `/brand` and the logo
PNG in the footer cube's menu are files. Treating a download like a page
transition would promise the wrong kind of result.

### Canonical identifiers for microformat parsers

Some anchors identify a page or its author for microformat parsers. Their
classes, such as `u-url` and `u-uid`, tell a parser that the href is a canonical
identifier, so those anchors need absolute canonical URLs. They include the
hidden `u-url` on `/writings` and `/initiatives`, a writing's hidden
`u-url u-uid`, the hidden h-feed author, and the homepage rail's name link.

Keep these as raw anchors. Most supply machine-readable identity rather than
a visible preview opportunity; the rail's visible name also serves that identity
role.

### The command palette's fallback

The command palette opens search in a temporary view. Its trigger is still a
link to `/search`, so a visitor without scripts can reach the search page.
With scripts, the click opens the palette and animates it from the trigger's
position. That animation needs a ref to the trigger element, which `SiteLink`
does not forward; the trigger therefore uses a raw anchor. Preserve its
`/search` href when changing the animation or palette behavior.

### Explain each reported exception at the href

When lint reports one of these anchors, place
`// eslint-disable-next-line site/no-raw-internal-anchor -- <reason>` on the
line above its href. State which exception applies and why it needs the plain
anchor. Add a disable comment only for these defined reasons.

A page destination receives `SiteLink`, including intercepted links such as
homepage tiles and venture names in the headline. An unusual visual design
alone does not justify another navigation implementation.

## When to turn the card off

Set `preview={false}` when the link already supplies card-like context: a
homepage tile, list item, Playbill act, project card, or navigation such as the
top bar and footer's page list. Floating another card over that object repeats
what the visitor is already reading and can obscure nearby choices.

Inline prose links, chips, and bylines keep the card because their destination
may otherwise be unclear until opened. The card helps a visitor assess a link
without requiring every sentence to contain a destination summary.

The footer's page list turns previews off. Its other destinations are external
sites, route handlers, or files, which never receive cards. This is why the
footer shows none; a new inline page link there would still need an explicit
decision about whether its context warrants a preview.

## What the card shows

### Page records and their sources

The registry in `lib/entities/registry.ts` supplies a kind, title, description,
optional cover, optional brand seed, and a line of context for each destination.
Content pages come from their loaders. Hand-written pages are listed in
`STATIC_PAGES` in `lib/entities/pages.ts`, mostly from `sitePages` in
`lib/site/navigation.ts`. A page outside that list, such as `/search`, which stays out of
the sitemap, receives its own `STATIC_PAGES` entry.

A destination missing from the registry gets no card. For a public page that
should have one, inspect its loader or static entry. Do not put destination
metadata into the link component as a one-off workaround: the shared record
also keeps search and other presentations of the page in agreement.

### Loading follows visitor intent

A visitor expresses preview intent by resting the mouse pointer on a link or
giving it visible keyboard focus. Once that intent reaches the show step,
`SiteLink` fetches `/entities.json` and reuses the successful request for the
visit. Waiting for intent avoids downloading preview data for someone who
only reads the page or follows a link immediately.

If the request fails, the link still navigates and no card appears. The failure
clears the cached promise so a later intent can try again. A temporary bad
response therefore costs the visitor a preview, rather than breaking the
destination or suppressing every card for the rest of the visit.

### Ventures retain their detail query

Homepage ventures and studio products come from `lib/home/ventures.ts` through
`VENTURE_CARDS` in `lib/entities/ventures.ts`. Each detail view has a card keyed
as `/?detail=<id>`. Write links in that form. A bare `?detail=<id>` is relative
and `SiteLink` treats it as external for preview classification, so it shows no
card.

The homepage detail query is the only query retained as a distinct card key.
Other destinations normally key by path alone, without origin, hash, or a
trailing slash. A hidden venture gets no card and is omitted from site search;
adding a link does not override that visibility decision.

### Tags use their dedicated pages

Each tag on a published writing receives a `tag` card from `tagCards` in
`lib/entities/tags.ts`, keyed as `/writings/tags/<tag>`. The title is the tag;
the description is a count such as “3 writings.” Use `tagPath()` from
`lib/writings/tags.ts` to construct tag links so encoding and route spelling
remain shared.

The old `/writings?tag=<tag>` form redirects to the tag page and normalizes to
that page's key. Site search lists the same tag cards as pages. An initiative,
part, venture, or product with a `brand` seed paints its card in the matching
Material 3 scheme, as its page and tile do.

## Behaviour and accessibility

### Opening and dismissal

The card appears after 250ms of intent from a mouse pointer or a visible focus
ring. A pointer can cross from the link to the card and rest there, as WCAG
1.4.13 requires for content shown on hover. The card closes 200ms after the
pointer leaves both objects, allowing time to cross the gap instead of closing
beneath the pointer.

Blur, Escape, scroll, resize, and a press on the link close it immediately.
An intent that ends while `/entities.json` is still loading cannot later open
a stale card. Touch never opens the card: a tap follows the destination rather
than spending the visitor's first action on a preview.

The card uses a `popover` element in the top layer, avoiding clipping by a
parent's overflow. Its motion is opacity plus a six-pixel rise; reduced motion
retains only the opacity change.

### The card repeats information, so it is hidden from assistive technology

The card is `aria-hidden`. It repeats the destination's title and description,
which a screen-reader user can reach by following the link. Reading that
optional repetition as part of the current page would add noise to ordinary
navigation.

This choice depends on a strict content boundary: anything essential belongs
in the link text or on the destination page, never only in the card. If a
proposed preview adds a new instruction, warning, or action, the existing
hidden preview contract cannot carry it. Put that information in accessible
page content instead.

## Open questions

External previews were considered and rejected. Fetching a destination's
metadata when someone hovered would send a request to that site before they
chose to visit it, disclosing interest through an otherwise local reading
action. External links therefore remain ordinary anchors without preview
fetches. Their missing cards are intentional.
