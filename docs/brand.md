# Brand kit and logo rules

Every WillieCubed file under `public/brand/`, and every rule for using the logo,
comes from one script: [`brand/build.mjs`](../brand/build.mjs). Run
`pnpm brand:build` after changing it. Never edit `public/brand/` or
`lib/brand/kit.json` by hand; the script deletes and rewrites both.

## Where the rules live

The usage rules sit in the script's "Usage rules" constants, next to the
geometry they measure:

- `GAP` is the space between the cube and the name in a lockup, as a share of
  the cube's drawn height. `CLEAR_SPACE` is the same number, so the clear-space
  unit _x_ is visible in every lockup.
- `SMALL_MAX_PX` is the height at or below which a mark switches to its
  `-small` cut. The favicon, the ICO, the 48px manifest icon, and Android's
  mdpi icon use the same constant, so the rule and the files can't drift.
- `MIN_SIZE` holds the smallest height on screen and in print for each kind of
  file.
- `SELECTION`, `PROHIBITED`, and `EXCEPTIONS` are the "Choosing a version" list,
  the "What to avoid" examples, and the platform-file exception.

Every logo file is trimmed to its drawing, so a file's edge is the logo's edge
and clear space is measured out from it. The cube-only files use the same crop
as [`components/brand/Mark.tsx`](../components/brand/Mark.tsx).

## What the build writes

- `lib/brand/kit.json`, which `/brand` renders. Each mark and lockup carries a
  `usage` block with its clear space, minimum size, and cube box; the page draws
  the clear-space diagrams from those numbers.
- `public/brand/guidelines.json` and `public/brand/guidelines.md`, the same rules
  for agents and tools, with absolute URLs. Both are in the kit's zip, and
  `/llms.txt` links them under "Brand".
- `public/brand/guide/`, images only the page uses. They stay out of the zip.

## The site's own exception

The footer cube on willie.page shifts between one color and the full-color
mark on hover, focus, and activation
([`components/site/FooterLockup.tsx`](../components/site/FooterLockup.tsx)).
That is an interactive state of the site, not a recoloring anyone else should
copy, so it lives here rather than on `/brand` or in the guidelines.

## Rebuilding on a different machine

The Apple renders under `public/brand/apple/` come from the local Xcode's Icon
Composer tooling, so a newer Xcode can change them without any source change.
Prefer the newer renders, since they match what current Apple platforms draw,
and say so in the commit that ships them.
