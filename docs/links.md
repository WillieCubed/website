# Links and hover cards

This page is for anyone writing a link in a component, a page, or MDX,
Willie or an agent. Read it before adding a link, and read
[design-principles.md](./design-principles.md) for why the site behaves this
way. When you finish, run `pnpm lint`; it rejects a raw `next/link` import.

## The rule

Every link on the site goes through `SiteLink` from
`components/link/SiteLink.tsx`. An in-site link (a path starting with `/`,
or an absolute URL on the canonical origin) gets client-side navigation and a
small card on hover or keyboard focus that says what the destination is. An
external link renders as a plain anchor with `rel="noopener"` and no card.
Hash links never get a card.

MDX prose gets this automatically through the `a` override in
`components/mdx/index.tsx`.

```tsx
import SiteLink from '@/components/link/SiteLink';

<SiteLink href="/initiatives/twd">The Willie Diaries</SiteLink>
<SiteLink href="/writings/project-superbloom" preview={false} className="card">…</SiteLink>
<SiteLink href="https://hypertext.studio">Hypertext Studio</SiteLink>
```

## When to turn the card off

Set `preview={false}` on a link that already is a card: a homepage tile, a
list item, a Playbill act, a project card, and navigation such as the top
bar. A second card floating over the thing under the pointer only repeats
it. Inline links in prose, footers, chips, and bylines keep the card.

## What the card shows

The card reads from the entity registry in `lib/entities/registry.ts`, which
lists every page on the site with a kind, a title, a description, an optional
cover, an optional brand seed, and one line of context. It is served once per
visit as `/entities.json`, and `SiteLink` fetches it the first time a visitor
shows intent. A page that is not in the registry gets no card, which is the
signal to add it: content pages come from their loaders, and hand-written
pages are listed in `STATIC_PAGES` at the top of the registry.

An initiative or part with a `brand` seed paints its card in that Material 3
scheme, the same way its page and tile do.

## Behaviour and accessibility

The card appears after 250ms of intent from a mouse pointer or a visible
focus ring, and closes on pointer leave, blur, Escape, scroll, or resize.
Touch never opens it, because a tap should navigate. It is a `popover`
element in the top layer, so it never fights a parent's overflow.

The card is `aria-hidden`. It only repeats the destination's own title and
description, which a screen reader user reaches one step later, so hiding
it keeps the "never put information only behind a hover" principle intact
rather than breaking it. Anything that matters belongs in the link text or
on the page, never only in the card.

Motion is an opacity and a six-pixel rise; reduced motion keeps only the
opacity.

## Open questions

The registry does not yet include the ventures on the homepage, so a link to
a venture tile's detail view has no card until `lib/home/ventures.ts` feeds
it. Cards for external sites were considered and rejected: fetching remote
metadata on hover leaks the visitor's interest to a third party.
