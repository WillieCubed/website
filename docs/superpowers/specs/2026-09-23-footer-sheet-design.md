# Footer sheet

Status: implemented 2026-09-23, tuned against screen recordings of the real
homepage rather than mockups. This is part A of three homepage changes; part
C (rail focuses) and part B (command palette search) have their own specs.

The homepage footer grows out of the rail's contact row over the last stretch
of scroll (components/site/footer-dock.css, driven by one number, `--p`). The
design stays; this pass fixes how it lines up and makes the end of the page
read as a surface.

## Decisions

| Question                    | Decision                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| Open row alignment          | The cube's seat closes as the cube rises, so the open row starts on the lockup's line             |
| Icons while docked          | No room held. Each link's icon slot and gap grow with `--dock`; the docked row is words alone     |
| What the page above does    | It becomes a sheet: it draws in from the window's sides and rounds its lower corners              |
| Sticky rail vs sliding away | The rail stays in the sheet and leaves with it, so the cut-off headline reads as a surface moving |
| Lockup size                 | Opens to 48px on wide windows (was 36px); 30px on a phone, where the name must fit one line       |
| Whitespace above the footer | Kept. It is part of the sheet, not a gap to close                                                 |
| Other pages                 | Unchanged: the plain footer from site.css. Only the homepage docks, so only it gets the sheet     |

## The sheet

FooterFrame writes the footer's progress on the root as `--footer-p`, and the
page's width as a plain number, `--page-w`, and marks the root with
`data-footer-dock` (and `data-footer-sheet` while `--footer-p` is above 0).

- `body > .grow`, the wrapper around every page's content, is scaled from its
  lower edge so a gap of 16px (10px on a phone) opens at each side. It is
  scaled, not narrowed, so nothing reflows while the visitor scrolls.
- Behind it the body turns from ground to the footer's tray at the same rate
  as the footer's own surface (`--surface`), so the footer's edges, while it
  is narrower than the window, disappear into it.
- Until it is fully open, the footer's opening starts a row's height above
  the page's end. The sheet is trimmed there with a rounded `clip-path`, so
  sheet and footer meet on one line and the footer never covers the sheet's
  corners. The clip removes the sheet's drop shadow; the rounded edge against
  the tray carries the surface instead.
- The scale is applied only while `data-footer-sheet` is set, because a
  transform makes the wrapper a containing block for fixed elements. Detail
  dialogs are in the top layer and unaffected.

## Phones

The row is not pinned while scrolling on a phone, as before. The lockup rises
through the stacked page links and tagline there, so both wait until it has
passed (`--from: 0.9`) instead of showing under it.

## Testing

Checked with Playwright screenshots at 0, 5, 15, 30, 60, 85, and 100 percent
open at 1440×900 and 390×844, and with recorded scrolls in both directions.
Unit tests, typecheck, and lint pass. The footer's maths in lib/footer/dock.ts
is unchanged.

## Known rough edges

- On wide windows the page links fade in at their final place before the
  lockup reaches its line.
- On a phone the docked row appears only as the page ends.
