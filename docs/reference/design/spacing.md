# Spacing

Fixed layout spacing uses a 4px grid. Choose a shared semantic role for the
relationship between elements; use a scale token when the relationship needs
a different size. Do not add a one-off gap or negative margin to make a local
composition fit. Group related markup or change its layout instead.

## Shared roles

These roles are available as CSS custom properties and Tailwind spacing
utilities. For example, `gap-inline` and `gap: var(--spacing-inline)` express
the same relationship.

| Role             | Default | Use                                                      |
| ---------------- | ------- | -------------------------------------------------------- |
| `related`        | 4px     | Closely related metadata or items within a small group   |
| `inline`         | 8px     | Icons and labels, adjacent controls, label-to-field gaps |
| `stack`          | 16px    | Separate content blocks within a group                   |
| `group`          | 24px    | Separate groups within a section                         |
| `section`        | 32px    | Separate sections                                        |
| `control-block`  | 8px     | Compact control padding along the block axis             |
| `control-inline` | 16px    | Control padding along the inline axis                    |
| `panel`          | 24px    | Content inset within a panel                             |

The existing `xs` through `3xl` scale remains available. Component-specific
roles describe larger layout relationships, such as the homepage's fold
preview and the editor's bottom clearance. A role should explain why space
exists, rather than rename an arbitrary number.

## Optical and accessibility exceptions

Keep a fixed value off the grid only when its purpose requires it. The
exception registry in `scripts/design/spacing-exceptions.json` identifies
the exact file, selector, property, value, and reason. It does not exempt
whole files or components. Remove an entry when the source no longer needs it.

The permitted cases are:

- Material 3 connected button groups use the shared 2px internal gap.
- The mobile sheet opens by 10px per edge as animation travel, independently
  of content width and spacing between blocks.
- Large music headings compensate for the left glyph bearing; small track
  and review numbers compensate for the adjacent text's baseline.
- The setup information icon aligns its artwork with the first text line.
- The playlist ending's 20px icon centers beside its 24px first text line.
- Temperature unit glyphs use small optical separations from the numeral.
- The brand guide deliberately crowds a logo to illustrate incorrect usage.
- The colophon specimen uses optical insets to balance its rotated organic
  silhouette around upright letterforms; they define artwork, not layout gaps.

These adjustments do not justify off-grid spacing between ordinary blocks,
menu items, controls, or labels. Font sizes, line heights, borders, corner
radii, and animation travel are separate systems and need not be multiples
of 4. Logo geometry follows the [brand contract](./brand.md).

## Fluid layout

Keep viewport-based spacing fluid when it serves responsive composition.
Use grid-aligned fixed endpoints in `clamp()` expressions; intermediate
values follow the viewport. Full-width image breakouts and text-relative
citation marks also follow their own geometry. Do not quantize those values
into jumps merely to make every computed pixel divisible by 4.

## Validation

Run `pnpm spacing:check` to inspect source styles, JSX utilities, inline React
spacing, embedded HTML styles, and spacing tokens. It fails on unexplained
fixed values and stale exception entries. The check also runs through lint
and `pnpm check`.

The same check rejects a raw `font-size` or `border-radius` whose value a
design token already holds, and names the token to use: a `--text-*` size or
a `--radius-*` corner. A size several text roles share goes to the role that
matches the rule's weight: label at 600 and above, title at 500, and body
otherwise. Values with no token, such as a 13px caption, stay as written.

For visual changes, compare uncropped desktop and mobile viewport screenshots
in both appearances, then inspect bounds at the affected breakpoints. Source
validation does not establish that a composition fits or that a control is
usable.
