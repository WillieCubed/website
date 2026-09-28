# Links and hover cards

This page is for anyone writing a link in a component, a page, or MDX,
Willie or an agent. Read it before adding a link, and read
[design-principles.md](./design-principles.md) for why the site behaves this
way. When you finish, run `pnpm lint`. It rejects a `next/link` import and a
hand-written `<a>` with an in-site href anywhere in `app/` or `components/`
outside `components/link/`.

## The rule

Every link on the site goes through `SiteLink` from
`components/link/SiteLink.tsx`. An in-site link (a path starting with `/`,
or an absolute URL whose origin is the canonical origin) gets client-side
navigation and a small card on hover or keyboard focus that says what the
destination is. An external link renders as a plain anchor with
`rel="noopener"` and no card. A host that only starts with the origin's
spelling, such as `https://willie.page.evil.com`, is external. Hash links
never get a card.

MDX prose gets this automatically through the `a` override in
`components/mdx/index.tsx`.

```tsx
import SiteLink from '@/components/link/SiteLink';

<SiteLink href="/initiatives/twd">The Willie Diaries</SiteLink>
<SiteLink href="/writings/project-superbloom" preview={false} className="card">…</SiteLink>
<SiteLink href="https://hypertext.studio">Hypertext Studio</SiteLink>
```

SiteLink calls a handler you pass for an event it also handles, such as
`onPointerDown` or `onFocus`, before its own, so yours never replaces the
card's. Calling `event.preventDefault()` in `onClick` stops the navigation,
which is how the homepage tiles open a detail view in place.

## What lint checks

Two rules enforce this. `no-restricted-imports` rejects a `next/link`
import. `site/no-raw-internal-anchor`, a local rule in
`eslint/no-raw-internal-anchor.mjs`, rejects a JSX `<a>` whose href is a
string or template literal starting with `/`, `?`, or
`https://willie.page`, or a template literal that opens with `site.origin`.
Both apply to `app/` and `components/` outside `components/link/`. The raw
anchor rule also skips the parked pages under `app/_(pages)`, which are not
routed.

The raw anchor rule reads the source, so it cannot see a computed href such
as `{link.href}` or `{absoluteUrl('/writings')}`. Those are up to whoever
writes them, under the same rule.

## When a raw anchor is right

Some in-site links must stay plain anchors. Each one the lint rule reports
carries `// eslint-disable-next-line site/no-raw-internal-anchor -- <reason>`
on the line above its href, and the reason says which of these it is:

- **A route handler, not a page.** `/coffee` and `/tea` (`BrewLink`, and the
  footer's 418 tagline, which links to `/coffee`) and the feeds in the
  footer's feeds button are served by route handlers the router cannot
  render, so they take a full navigation.
- **A file download.** The brand kit files on `/brand` and the logo PNG in
  the footer cube's menu are files, not pages.
- **A microformat anchor.** The hidden `u-url` on `/writings` and
  `/initiatives`, a writing's hidden `u-url u-uid`, the hidden h-feed author,
  and the homepage rail's name link are read by parsers, which need the
  absolute canonical URL.
- **The palette trigger.** Its `/search` href is the fallback for a visitor
  without scripts. With scripts the click opens the palette, which morphs
  from the trigger's element by ref, and SiteLink does not forward a ref.

Add a disable comment only for one of these reasons. A link to a page gets
`SiteLink` even when its click is intercepted, like the homepage tiles and
the venture names in the headline.

## When to turn the card off

Set `preview={false}` on a link that already is a card: a homepage tile, a
list item, a Playbill act, a project card, and navigation such as the top
bar and the footer's list of pages. A second card floating over the thing
under the pointer only repeats it. Inline links in prose, chips, and bylines
keep the card. The footer shows none: its page list turns the card off, and
its other links go to other sites, route handlers, or files, which never get
one.

## What the card shows

The card reads from the entity registry in `lib/entities/registry.ts`, which
lists every page on the site with a kind, a title, a description, an optional
cover, an optional brand seed, and one line of context. It is served once per
visit as `/entities.json`, and `SiteLink` fetches it the first time a visitor
shows intent. If that request fails, the intent shows no card and the next
intent fetches again. A page that is not in the registry gets no card, which
is the signal to add it: content pages come from their loaders, and
hand-written pages are listed in `STATIC_PAGES` in `lib/entities/pages.ts`.
Most of those come from `sitePages` in `lib/site.ts`. A page kept out of
that list, such as `/search`, which stays out of the sitemap, gets its own
entry in `STATIC_PAGES`.

The homepage ventures and studio products come from `lib/home/ventures.ts`
through `VENTURE_CARDS` in `lib/entities/ventures.ts`, one card per detail
view, keyed as `/?detail=<id>`. Write those links as `/?detail=<id>`: a bare
`?detail=<id>` is relative, so SiteLink treats it as external and shows no
card. That query is the only one the registry key keeps; every other link is
keyed by its path alone. A venture marked `hidden` gets no card, and site
search leaves it out too.

Each tag on a published writing gets a `tag` card from `tagCards` in
`lib/entities/tags.ts`, keyed by its page, `/writings/tags/<tag>`. The title
is the tag and the description is a count such as "3 writings". Write tag
links with `tagPath()` from `lib/writings/tags.ts`. An old
`/writings?tag=<tag>` link redirects to the tag page, so it keys as that page
and shows its card. Site search lists the same cards as pages.

An initiative, part, venture, or product with a `brand` seed paints its card
in that Material 3 scheme, the same way its page and tile do.

## Behaviour and accessibility

The card appears after 250ms of intent from a mouse pointer or a visible
focus ring. The pointer can move from the link onto the card and rest
there, as WCAG 1.4.13 asks of content shown on hover. The card closes 200ms
after the pointer has left both the link and the card, and at once on blur,
Escape, scroll, resize, or a press on the link. An intent that ends while
`/entities.json` is still loading never opens the card. Touch never opens
it, because a tap should navigate. It is a `popover` element in the top
layer, so it never fights a parent's overflow.

The card is `aria-hidden`. It only repeats the destination's own title and
description, which a screen reader user reaches one step later, so hiding
it keeps the "never put information only behind a hover" principle intact
rather than breaking it. Anything that matters belongs in the link text or
on the page, never only in the card.

Motion is an opacity and a six-pixel rise; reduced motion keeps only the
opacity.

## Open questions

Cards for external sites were considered and rejected: fetching remote
metadata on hover leaks the visitor's interest to a third party.
