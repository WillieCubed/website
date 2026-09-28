# Scrollbars

Status: designed 2026-09-28, approved for building. For a maintainer
changing how anything on the site scrolls.

Every scrollbar on the site draws the browser default. The one rule that
looks like styling, `scrollbar-w-8 scrollbar-track-surface-container` on
`<body>` through the `tailwind-scrollbar` plugin, does nothing: it computes
to a transparent thumb, and the page scrolls on `<html>`, where colors set on
`<body>` never reach. On systems that draw classic scrollbars (Windows,
Linux, a Mac set to always show them), opening the homepage detail view hides
the page scrollbar and the whole page jumps about 15px sideways.

## Decisions

| Question            | Decision                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Mechanism           | Standard `scrollbar-color`, `scrollbar-width`, and `scrollbar-gutter`. No `::-webkit-scrollbar`, no plugin                     |
| Page thumb          | `outline` at 50% over a transparent track, set once on `:root`; inner scrollers inherit it                                     |
| Hover               | A scroller under the pointer shows its thumb at full `outline`                                                                 |
| Inner scrollers     | Detail view, command palette results and readout, brand page wide preview: `scrollbar-width: thin`                             |
| Branded detail view | Thumb in the venture's `primary` at 45%, full `primary` on hover; the brand scheme has no `outline` role                       |
| Layout shift        | `scrollbar-gutter: stable` on `:root`, so hiding the page scrollbar under the detail view moves nothing                        |
| Swipe rows          | The studio product row and the writings filter chips keep hiding their scrollbars                                              |
| Rounded corners     | The two-column detail card scrolls only its text column, inset 12px from the card's edges; below 840px the view is full-screen |

## Turned down

A custom pill thumb drawn with `::-webkit-scrollbar` looks the most polished
on Windows, but Chrome ignores those pseudo-elements whenever a standard
`scrollbar-color` applies, Firefox never draws them, and it takes about three
times the CSS. Hiding dialog scrollbars behind an edge fade removes the one
plain sign that a dialog scrolls.

## Open

Safari ignores `scrollbar-color` and keeps its own overlay scrollbars, so
nothing here changes on a Mac with default settings. If Safari ships the
property, it picks these rules up without changes.
