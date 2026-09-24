# Rail focuses

Status: implemented 2026-09-23, from a design critique of the homepage.
This is part C of three homepage changes; part A (footer and scroll)
and part B (command palette search) get their own specs.

The homepage rail currently lists Willie's three ventures, which the bio
paragraph directly above it also names. The grid beside it already shows
individual projects. The rail should say what Willie is working toward, and
leave the organizations to the bio and the tiles.

## Decisions

| Question                    | Decision                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| What the rail's list is     | Focuses: what Willie is working toward, in his own words                                         |
| Headline facet keys         | Removed. "software", "systems", and "people" become plain text; focuses are the only filter      |
| Bio paragraph               | Kept as the "where": venture names become plain links that open each venture's detail view       |
| Focus with no visible tiles | Shown as plain text: no hover, no link, no toggle, until a tile names it                         |
| Tile with no focus          | Stays in the feed (Curfew, Project Superbloom); the feed is not limited to focuses               |
| Rail thumbnails             | Replaced by each focus's app icons (`icons` in focuses.ts), which fan out on hover as ja.mt's do |
| Search in the rail          | Stays where it is for now; its look and final place are part B                                   |

## The focuses

In this order, under the plain label "Focuses":

| id         | Line                                                    | Tiles                                         |
| ---------- | ------------------------------------------------------- | --------------------------------------------- |
| `cities`   | Fighting for light rail and more walkable neighborhoods | `lvbt`, `transitmapper`                       |
| `helpers`  | Finding the helpers throughout the country              | `atlas` (hidden today, so plain text for now) |
| `lovelace` | Building an intelligent computer for everyone           | `rtc`                                         |
| `tools`    | Building tools to help people plan and live their lives | `logdate`, `docket`, `hypertext`              |
| `diaries`  | Filming a silly little video diary                      | `initiative-fall-tour-2026`                   |

Fall Tour 2026 is a part of The Willie Diaries (`parent: twd`), so the diary
focus lights it. Curfew and Project Superbloom carry no focus.

## Data

- `lib/home/focuses.ts` exports `Focus = { id: FocusId; line: string }` and
  the ordered list above. It holds no tile ids.
- Each tile declares its own focuses, replacing `facets`:
  - Ventures and products in `lib/home/ventures.ts`: `focuses: FocusId[]`.
  - Featured initiatives: `feature.focuses` in frontmatter, validated in
    `lib/initiatives/schema.ts` against the focus ids, so featuring an
    initiative stays a frontmatter edit (docs/initiatives.md).
- A focus is live when at least one visible tile names it; the rail derives
  this, nobody sets it by hand.
- Removed: the `Facet` type, `FacetSchema`, `FacetKey`, `isFacetPressed`,
  `facetEntries`, and every `facets` field. `railVentures` and `IndexRow` go
  if nothing else uses them.

## Interaction

`Preview` becomes `{ focus: FocusId } | { id: string } | null`, and the shell
logic in `HomeShell` stays the same shape with focuses in place of facets.

- Pointing at or focusing a live focus row lights its tiles and softens the
  rest, as the facet keys do today. On touch, a tap toggles it and a second
  tap clears it.
- Pointing at a tile marks the focus rows that name it, the way tiles light
  the facet keys today.
- An active row takes its first tile's brand scheme (the Brand principle in
  docs/design-principles.md), on a tonal container rather than an underline.
  A plain-text row has no container, following the rule that only
  interactive things sit in containers.
- Every row transition has a reduced-motion fallback.

## Layout

The rail has three groups: intro (headline and bio), search, and focuses.
Items inside a group sit close together; the gap between groups is clearly
larger. Groups are separated by space alone, never by divider lines.

On compact and medium widths the order stays the same in one column. While
a focus is toggled on, its lit tiles move to the front of the stacked feed,
animated with the grid's existing reordering, so the visitor sees them
without scrolling.

## Testing

- Unit: every tile's focus ids exist; the live-focus derivation (a hidden
  tile does not make a focus live); frontmatter rejects an unknown focus.
- Playwright: hovering a live focus lights exactly its tiles; a plain-text
  focus has no button role; tapping on a phone-sized viewport toggles and
  reorders; the existing axe run passes on the homepage.

## Out of scope

Footer and scroll behavior (part A), the command palette and where search
finally lives (part B), and any new tiles for Atlas or the Diaries.
