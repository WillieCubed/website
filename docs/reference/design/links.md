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

`isInternalHref()` in `lib/site.ts` determines whether the destination is on
the canonical origin. It accepts site paths beginning with `/` and absolute
HTTP(S) URLs only when URL parsing resolves them to that origin. A spelling
prefix is insufficient: `https://willie.page.evil.com` and `//other.example`
leave the site. Centralizing this decision keeps navigation and preview
behavior aligned with where the browser will actually go.

MDX prose receives `SiteLink` through the `a` override in
`components/mdx/index.tsx`. Authors can write ordinary Markdown links; they do
not need to reproduce the component's behavior in each article.

```tsx
import SiteLink from '@/components/link/SiteLink';

<SiteLink href="/initiatives/twd">The Willie Diaries</SiteLink>
<SiteLink href="/writings/project-superbloom" preview={false} className="card">…</SiteLink>
<SiteLink href="https://hypertext.studio">Hypertext Studio</SiteLink>
```

### Event handlers compose with the shared behavior

For events it handles, such as `onPointerDown` and `onFocus`, `SiteLink` calls
the caller's handler before its own. Adding a handler therefore does not replace
the preview behavior. An `onClick` handler can call `event.preventDefault()`
to stop navigation; homepage tiles use this to open a detail view in place.

A page link remains a `SiteLink` even when its enhanced click behavior is
intercepted. Its href supplies the destination for ordinary navigation, while
the handler supplies the richer interaction. That distinction protects the
JavaScript-free route to the same content.

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

Both rules apply to `app/` and `components/` outside `components/link/`. The
raw-anchor rule also skips `app/_(pages)`, whose parked pages are not routed.
That scope explains what a passing lint result has inspected; it does not
create a different design rule for other code.

### Computed hrefs still need review

The source rule cannot follow a value such as `{link.href}` or
`{absoluteUrl('/writings')}` to discover its destination. Check those links
manually. The same `SiteLink` requirement applies, even when lint cannot
recognize the address.

Lint and runtime classification serve different purposes. The first finds
obvious violations during editing; the second decides actual navigation and
preview behavior from the supplied URL. Passing one does not prove that every
computed link follows the contract.

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

The hidden `u-url` on `/writings` and `/initiatives`, a writing's hidden
`u-url u-uid`, the hidden h-feed author, and the homepage rail's name link
are microformat anchors. Parsers need their absolute canonical URLs. These
anchors supply structured identity as well as, where visible, a destination;
they follow the explicit parser contract rather than the preview convention.

### The command palette's fallback

The palette trigger retains a raw `/search` href for visitors without scripts.
With scripts, its click opens the palette, which morphs from the trigger element
through a ref. `SiteLink` does not forward that ref, so this trigger is a
specific exception. The plain href is still essential: opening the palette
must enhance a working search destination.

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

The footer shows no cards. Its page list turns them off, and its remaining
links go to other sites, route handlers, or files. Those destinations never
receive a card. Use that composition as the explanation, rather than adding
a special global “footer” exception.

## What the card shows

### Page records and their sources

The registry in `lib/entities/registry.ts` supplies a kind, title, description,
optional cover, optional brand seed, and a line of context for each destination.
Content pages come from their loaders. Hand-written pages are listed in
`STATIC_PAGES` in `lib/entities/pages.ts`, mostly from `sitePages` in
`lib/site.ts`. A page outside that list, such as `/search`, which stays out of
the sitemap, receives its own `STATIC_PAGES` entry.

A destination missing from the registry gets no card. For a public page that
should have one, inspect its loader or static entry. Do not put destination
metadata into the link component as a one-off workaround: the shared record
also keeps search and other presentations of the page in agreement.

### Loading follows visitor intent

The registry is served as `/entities.json`. `SiteLink` fetches it when the
first preview intent reaches the show step and reuses the successful request
for the visit. A failed request shows no card and clears the cached promise,
so a later intent can retry. Navigation does not depend on the registry being
available.

This failure behavior matters during a bad response or cold start. An optional
preview should disappear quietly while the working link remains; one failed
request should not disable all previews for the rest of the visit.

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

The site does not fetch external metadata on hover. Such a request would tell
a third party about a visitor's interest before the visitor chose to follow
the link. Keeping external links as ordinary anchors avoids that disclosure
and keeps a reading action from silently becoming a remote request.

This is a recorded design decision, not an incomplete registry feature.
Missing cards for external destinations do not require repair.
