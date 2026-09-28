# Initiatives

This page is for anyone adding or editing an initiative page under
`/initiatives`, Willie or an agent. Read it before touching
`content/initiatives/`. When you finish, run `pnpm typecheck && pnpm build`,
because the schema fails the build on a bad field.

An initiative is a campaign, a series, or a project that deserves its own page:
Fall Tour 2026, The Willie Diaries, Project Superbloom. Ventures with their own
websites (Las Vegans for Better Transit, Hypertext Studio, the Reasonable Tech
Company) are not initiatives; they live in `lib/home/ventures.ts` and link out.

## Files

```
content/initiatives/<slug>/index.mdx        the initiative page
content/initiatives/<slug>/parts/<n>.mdx    one act, served at /initiatives/<slug>/part-<n>
public/assets/initiatives/<slug>/           cover art and part media
```

The loader is `lib/initiatives/index.ts`. It validates frontmatter with the zod
schemas in `lib/initiatives/schema.ts`, resolves each status from its dates when
the author leaves `status` out, and exposes `getInitiatives`, `getInitiative`,
`getPart`, `getFeaturedInitiatives`, and `currentPart`. Results are cached with
`'use cache'` for an hour, which is also what lets them read the clock under
`cacheComponents`.

## Initiative frontmatter

| Field         | Required | Meaning                                                                                                                    |
| ------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `title`       | yes      | The name.                                                                                                                  |
| `tagline`     | yes      | One line under the title.                                                                                                  |
| `description` | yes      | One or two sentences for the index card, the meta description, and the hover card.                                         |
| `kind`        | yes      | `campaign`, `series`, or `project`. Search tags the initiative with it; the page never prints it.                          |
| `parent`      | no       | Slug of the initiative this belongs to. Fall Tour sets `twd`. An unknown slug fails the build.                             |
| `status`      | no       | `planned`, `active`, `paused`, `complete`, `archived`. Leave it out to derive it from `starts` and `ends`.                 |
| `starts`      | no       | ISO date. Falls back to the first part's start.                                                                            |
| `ends`        | no       | ISO date. Falls back to the last part's end.                                                                               |
| `updated`     | no       | ISO date of the last real edit. Sets the sitemap's last-modified date; leave it out when unsure.                           |
| `brand`       | no       | A `#rrggbb` seed or a key in `lib/brand/seeds.json`, resolved to its hex when loaded. An unknown key fails the build.      |
| `cover`       | no       | `{ src, alt, kind?, aspect? }`. Used for the hero, the index card, and social images. A missing file fails `pnpm test`.    |
| `trailer`     | no       | `{ title, youtubeId?, poster? }`. Without `youtubeId` the page shows the poster or cover in the video's frame.             |
| `partLabel`   | no       | The word before an act number. Defaults to `Part`; The Willie Diaries uses `Era`.                                          |
| `website`     | no       | The initiative's own site, as an `https://` URL. The hero links to it; Superbloom points at its own site.                  |
| `links`       | no       | `[{ label, href }]`. Chips at the end of the page. A chip whose in-site page is still a draft stays hidden until it ships. |
| `syndication` | no       | `[{ platform, url }]`. Copies of this page elsewhere. Parsed but not rendered yet.                                         |
| `feature`     | no       | Puts the initiative on the homepage. See below.                                                                            |
| `draft`       | no       | Hidden in production.                                                                                                      |

## Part frontmatter

| Field         | Required | Meaning                                                                  |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `number`      | yes      | The act number. The URL is `part-<number>`. Two parts cannot share one.  |
| `title`       | yes      |                                                                          |
| `tagline`     | no       | One line under the title in the hero and the Playbill.                   |
| `description` | no       | Meta description. Falls back to the tagline.                             |
| `starts`      | yes      | ISO date.                                                                |
| `ends`        | yes      | ISO date, no earlier than `starts`.                                      |
| `updated`     | no       | ISO date of the last real edit. Sets the sitemap's last-modified date.   |
| `status`      | no       | Same values as above; derived from dates when missing.                   |
| `places`      | no       | `[{ name, region?, lat, lng }]` in travel order. Drawn on the route map. |
| `cover`       | no       | Hero media. Falls back to the initiative cover.                          |
| `milestones`  | no       | `[{ id, label, date, done? }]`. Listed in the sidebar in date order.     |
| `draft`       | no       | Hidden in production, like a draft initiative.                           |

## The homepage `feature` block

```yaml
feature:
  weight: 90 # 0–100; LVBT is 100, Atlas is 10, so 90 lands beside LVBT
  size: w3 h3 # grid spans: w2 h2, w2 h3, w3 h2, w3 h3, w4 h3, w6 h3
  hint: What's blooming # the hover chip
  focuses: [tools] # which rail focuses light the tile (lib/home/focuses.ts)
```

Weight decides order, not the file name. The homepage merges ventures and
featured initiatives and sorts by weight, so moving Superbloom down is one
number.

## Writing the body

The body is MDX. Besides the usual Markdown, three components are available
on initiative and part pages:

- `<Scene src="/assets/initiatives/x/1.jpg" alt="…" flip caption="…">prose</Scene>`
  puts media beside a few paragraphs. Alternate `flip` down the page.
- `<Gallery items={[{ src, alt }, …]} columns={3} />` is a photo grid.
- `<RouteMap places={[{ name, lat, lng }]} />` draws places on a plain grid
  with a dashed line between them. There is no continent outline on purpose.

The part page already renders the hero, milestones, places, and prev/next
navigation from frontmatter, so the body should be the story, not a repeat of
the metadata. Away from its initiative, in a tab, a link preview, or a search
result, a part is named by `partTitle()`: "Fall Tour 2026 Part 1: A Boy Goes
Back to Dallas". See [metadata.md](./metadata.md).

## Accessibility

Every act in the Playbill is in the HTML in order and readable without
JavaScript. The scroll reveal is an entrance only; it never hides content.
The current act carries `aria-current="step"`, and a future act shows its
date range instead of disappearing.

## Open questions

Trailer video ids and real cover photos are still to come from Willie; the
SVG covers under `public/assets/initiatives/` are placeholders. Brand seeds
for initiatives are hand-picked hexes because they have no site to resolve
from.
