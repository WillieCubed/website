# Initiatives

Initiative pages live under `/initiatives` and read files from
`content/initiatives/`. After editing them, run `pnpm typecheck && pnpm build`.
An invalid schema field fails the build.

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

### Loading and validation

The loader is `lib/initiatives/index.ts`. It validates frontmatter with the zod
schemas in `lib/initiatives/schema.ts`, resolves each status from its dates when
the author leaves `status` out, and exposes `getInitiatives`, `getInitiative`,
`getPart`, `getFeaturedInitiatives`, and `currentPart`. Results are cached with
`'use cache'` for an hour, which is also what lets them read the clock under
`cacheComponents`.

The directory gives an initiative room for both its overview and a sequence of
parts without flattening those parts into unrelated posts. A part's frontmatter
number supplies its public `part-<n>` address; renaming a source file is not how
you renumber the story. Underscore-prefixed directories and part files are
ignored, and `opengraph-image` is reserved rather than treated as an initiative.

## Initiative frontmatter

The overview fields describe the initiative wherever it appears. Keep the
`description` useful outside the page: the index, search metadata, and hover
card cannot rely on the visitor having read its introduction.

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

### Dates and resolved status

Dates describe calendar days. `DateSchema` re-anchors YAML dates to local
midnight because interpreting a bare date as UTC would display the preceding
day west of Greenwich. Do not add a time or offset to express an initiative's
start day; writings use a different timestamp contract.

With no explicit `status`, the loader resolves `planned` before `starts`,
`active` once it has started, and `complete` after the end of the `ends` day.
An undated initiative resolves to `planned`. Set an explicit value for a state
such as `paused` or `archived` that dates cannot express. Missing overview dates
come from the first and last numbered parts, keeping the overview tied to the
sequence it introduces.

`updated` records a meaningful editorial change for the sitemap. Leaving it
unset is preferable to presenting an arbitrary date as evidence of freshness.

### Media and links

A cover is shared by the hero, index card, and social image. Its `aspect` is a
positive width-to-height ratio that reserves space before loading; `kind`
defaults to `image` and also accepts `video`. The media schema additionally
supports `decorative: true` with empty alt text under the site's image policy.
Descriptions and image alternatives should make sense in each of those contexts.

`trailer` may exist before its YouTube video does. Without `youtubeId`, the
poster or cover occupies the video frame; that supports a prepared layout
without implying a published video. `syndication` records copies elsewhere but
is not yet rendered, so setting it does not add public copy links.

## Part frontmatter

| Field         | Required | Meaning                                                                  |
| ------------- | -------- | ------------------------------------------------------------------------ |
| `number`      | yes      | The act number. The URL is `part-<number>`. Two parts cannot share one.  |
| `title`       | yes      | The part title, combined with its initiative name outside the page.      |
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

### Sequence, places, and milestones

`number` is a positive integer, unique within its initiative. Parts sort by that
number, while milestones sort by date. The distinction lets a story preserve
its editorial order without requiring every sidebar event to follow source
file order. An `ends` value before `starts` fails loading rather than producing
a contradictory date range.

Places stay in travel order. Each requires a name and latitude/longitude in
the valid ranges −90 to 90 and −180 to 180; `region` is optional. Reordering
places changes the route the map draws. Milestone `done` defaults to `false`,
so a listed event is not automatically presented as accomplished.

A part can be drafted independently of its parent. Its production visibility
therefore needs review alongside the initiative's own draft flag, particularly
when overview dates are inherited from the visible part sequence.

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

### Choosing prominence

`size` controls grid spans; `weight` controls the merged ordering of initiatives
and ventures. Changing one does not change the other. The supported spans are
listed in the example, with `w3 h3` the default. `hint` is required, and
`focuses` defaults to an empty list; focus IDs must come from
`lib/home/focuses.ts`. Use the rail's existing vocabulary so a tile responds to
the same interests as the ventures beside it.

A featured tile is an additional entrance to an initiative. Its hint can invite
someone into the work without repeating the description already used by cards
and metadata.

## Writing the body

### Scenes, galleries, and routes

The body is MDX. Besides the usual Markdown, three components are available on
initiative and part pages:

- `<Scene src="/assets/initiatives/x/1.jpg" alt="…" flip caption="…">prose</Scene>`
  puts media beside a few paragraphs. Alternate `flip` down the page.
- `<Gallery items={[{ src, alt }, …]} columns={3} />` is a photo grid.
- `<RouteMap places={[{ name, lat, lng }]} />` draws places on a plain grid
  with a dashed line between them. There is no continent outline on purpose.

### What the page supplies

The part page already renders the hero, milestones, places, and prev/next
navigation from frontmatter, so the body should be the story, not a repeat of
the metadata. Away from its initiative, in a tab, a link preview, or a search
result, a part is named by `partTitle()`: "Fall Tour 2026 Part 1: A Boy Goes
Back to Dallas". See [metadata.md](../design/metadata.md).

That full title is needed because “Part 1” loses its meaning outside the
initiative. Keep the body focused on what happened and what it means; the page
already owns the sequence and wayfinding. A later change to a date or milestone
then has one structured source rather than conflicting copies in prose.

## Accessibility

Every act in the Playbill is in the HTML in order and readable without
JavaScript. The scroll reveal is an entrance only; it never hides content. The
current act carries `aria-current="step"`, and a future act shows its date range
instead of disappearing.

The reveal should reward scrolling without making scrolling or script execution
a prerequisite for reading. Check the Playbill with JavaScript unavailable and
with reduced motion enabled when changing this interaction. A future act still
belongs to the story's structure, even though its date range takes the place of
an active state.

## Open questions

Trailer video ids and real cover photos are still to come from Willie; the SVG
covers under `public/assets/initiatives/` are placeholders. Brand seeds for
initiatives are hand-picked hexes because they have no site to resolve from.
Treat these as outstanding source material. A placeholder cover or empty video
ID establishes the layout, not approval of the final imagery or trailer. Replace
them with Willie's supplied material and rerun the media checks before treating
the page as editorially finished.
