# Brand kit and logo rules

[`brand/build.mjs`](../../../brand/build.mjs) generates the WillieCubed logo
files and usage rules. Edit that source, then run `pnpm brand:build`. Do not
edit `public/brand/` or `lib/brand/kit.json` by hand: the generator deletes and
rewrites both.

The generator keeps the drawings, downloadable files, diagrams, and written
rules tied to the same measurements. A manual correction to one output would
last only until the next build and could disagree with the version someone
downloads from `/brand`.

## Where the rules live

### Geometry and clear space

The script's “Usage rules” constants sit beside the geometry they measure.
`GAP` is the space between the cube and the name in a lockup, expressed as a
share of the cube's drawn height. `CLEAR_SPACE` uses the same number: the
clear-space unit _x_ is visible inside every lockup as the gap between its two
parts. The current value is 0.25, so _x_ is 25% of the cube's drawn height.

Every logo file is trimmed to its drawing. Measure clear space outward from
the file's edge on all four sides; there is no invisible padding in the file
that already satisfies the rule. Cube-only files use the same crop as
[`components/brand/Mark.tsx`](../../../components/brand/Mark.tsx), keeping the
site's rendered mark and the downloadable mark aligned.

### Small versions and minimum sizes

`SMALL_MAX_PX` defines the height at or below which a mark uses its `-small`
cut. The current threshold is 48px. Those cuts widen the gaps between faces so
the cube remains legible at small sizes. The favicon, ICO, 48px manifest icon,
and Android mdpi icon use the same constant; updating the threshold therefore
changes both the rule and the files selected for those uses.

`MIN_SIZE` holds the smallest screen and print heights for each kind of file.
These values measure the file's height in pixels or millimeters. Read the
specific asset's generated `minSize` entry rather than borrowing a value from
another kind of mark. Lockups and the wordmark have no small cut, so their
minimum sizes remain the constraint.

### Selection and prohibited treatments

`SELECTION`, `PROHIBITED`, and `EXCEPTIONS` generate “Choosing a version,”
“What to avoid,” and the platform-file exception. Use a name lockup when
introducing Willie to someone who may not recognize the cube, a WillieCubed
lockup when crediting work made under that name, and a wordmark when the cube
is already nearby. Choose the provided light, dark, or one-color variant for
the placement rather than recoloring an asset.

The drawings retain their angles, proportions, face order, type, and flat
appearance. Do not rotate, stretch, skew, redraw, rearrange, or add effects to
them. The cube's angles make it read as a cube, and its small cuts solve a
specific legibility problem; treating either as incidental decoration defeats
those choices.

Platform files under `web/`, `apple/`, `android/`, and `social/` follow their
platform's templates and keep their supplied artwork. The general clear-space
and minimum-size rules apply to files in `mark/` and `lockups/`. A platform's
masking template is a defined exception, not permission to rearrange a lockup
for another use.

## What the build writes

### The page's structured kit

`lib/brand/kit.json` supplies `/brand`. Each mark and lockup carries a `usage`
block with its clear space, minimum size, and cube box. The page draws its
clear-space diagrams from those numbers, so the diagram explains the actual
asset rather than a separately maintained illustration.

When changing geometry, review the diagram together with the file. A correct
number rendered against an unexpected crop can still teach the wrong
placement.

### Rules for downloads, agents, and tools

`public/brand/guidelines.json` and `public/brand/guidelines.md` express the same
rules with absolute URLs. Both are included in the kit zip, and `/llms.txt`
links to them under “Brand.” The JSON provides structured measurements; the
Markdown gives a readable account of how to apply them. Neither is an
independent policy source.

`public/brand/guide/` contains images used only by the page and stays out of
the zip. That distinction keeps explanatory page graphics separate from the
assets someone should use in their own work.

## The site's own exception

The cube on willie.page's footer shifts between one color and the full-color
mark on hover, focus, and activation. The implementation lives in
[`components/site/FooterLockup.tsx`](../../../components/site/FooterLockup.tsx).
Its color change belongs to that object's interactive state on the personal
site.

Keep this exception here, outside `/brand` and the generated guidelines. A
visitor downloading a logo needs a rule for placing the supplied asset, and
must not infer that the footer grants general permission to recolor the faces.
The exception does not alter the geometry or the selection rules for other
uses.

## Rebuilding on a different machine

The Apple renders in `public/brand/apple/` come from the local Xcode's Icon
Composer tooling. A newer Xcode can therefore change those outputs even when
the source is unchanged. Review generated differences with that dependency in
mind instead of assuming every changed render reflects an intentional edit to
the logo.

Prefer newer renders because they match what current Apple platforms draw,
and name the tooling change in the commit that ships them. This explanation
lets a later reviewer distinguish a platform-rendering update from a redesign.
Rebuilding the kit establishes generated output; it does not by itself verify
how every platform will display an installed icon.
