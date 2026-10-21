# Interaction states

Material 3 Expressive distinguishes keyboard focus, an actual press, and a
persistent selection. Music and the rest of the site share the same control
contract. Resting shapes can express the component and its context; state
feedback must remain predictable.

## Action controls

Add `site-control` to an action button or an action-like navigation link.
`Button` supplies it automatically. The global interaction stylesheet owns
the hit target, pressed shape, focus indicator, disabled treatment, and reduced
motion. Component styles own the resting shape and Material color roles.

Material offers five visual sizes. Size and emphasis communicate an action's
role; the clickable area is a separate accessibility decision.

| Size        | Visible height | Minimum hit area | Pressed corner |
| ----------- | -------------- | ---------------- | -------------- |
| Extra small | 32px           | 48px             | 8px            |
| Small       | 40px           | 48px             | 8px            |
| Medium      | 56px           | 56px             | 12px           |
| Large       | 96px           | 96px             | 16px           |
| Extra large | 136px          | 136px            | 16px           |

Use `Button size="small"` for ordinary form actions and toolbar controls, and
`size="extra-small"` for repeated utilities. A `.site-control__surface` inside
the semantic control paints the smaller container; the transparent padding
remains clickable. Raw action links can use the same surface and
`data-control-size`. Unsized controls retain their existing 48px treatment;
do not resize every control merely because a shared default changed.

These sizes follow the [button](https://m3.material.io/components/buttons/specs)
and [icon-button](https://m3.material.io/components/icon-buttons/specs) scales.
Choose visual emphasis independently: primary fill for the current forward or
commit action, quiet treatment for cancel, refresh, formatting and secondary
navigation. Equal previous/next actions receive equal treatment. A navigation
link must not look persistently selected simply because it opens a directory.

Footer contacts, status, and Feeds must stay on one row under all conditions,
including the homepage dock, enlarged text, missing weather, and long city names.
Never wrap or stack the groups or their text. Contact links use at least
44px-square native targets in compact footer columns and 48px-square minima when space permits.
Feeds retains a 48px-square target and a 4px gap from status.
Icon-only profile targets have zero extra margin or gap, including during dock transitions.
City and temperature retain their full content width and horizontal padding;
location artwork and clock text yield first. The profile strip scrolls
horizontally when necessary, keeping every link reachable by touch and keyboard.
At extreme widths or text sizes, the row itself can scroll horizontally;
it must never create a second line. Focus indicators stay inside scrolling
boundaries. With no weather, retain the city/status fallback.

`tests/e2e/site/site/footer-row-contract.spec.mts` enforces the rule in the CI
browser suite with retries disabled. It checks computed no-wrap rules, actual
group and target alignment, row height, and unbroken city text across viewport
and content stress cases. A deliberately broken layout must fail the guard.
Do not relax these assertions to accommodate a wrapping design.
Run it directly with `pnpm test:footer-row` after a production build.

The expanded footer shares brand typography, control weights, internal padding,
and vertical spacing across pages. Its outer width follows the page's content
column. The homepage dock animates into this shared composition; its animated
brand position and size must end at the same dimensions as a plain footer.
`footer-consistency.spec.mts` compares rendered typography and gaps across
home, colophon, writings, and music, including JavaScript-disabled rendering.

Every page uses the same scroll-driven transition into its footer: the content
surface draws inward and rounds its lower corners as the footer arrives, then
returns to its normal shape when scrolling back up. Only the homepage starts
with a compact contact dock. Other pages keep their footer in normal document
flow, with the existing content-to-footer space inside the rounded surface.
Reduced motion keeps a static rounded ending without scaling. Short pages
and footers taller than the viewport retain their natural layout, and all
content and footer links work without JavaScript. The motion controller resets
when the page's column or dock mode changes and remeasures content during
client navigation. `page-footer-motion.spec.mts` checks intermediate and expanded
states, reverse scrolling, client navigation, and those fallbacks.

Webrings use 44px-square native targets with 32px visible surfaces, an
outlined group, and tonal directory links. Compact footer link sizing meets
[WCAG's enhanced target-size criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
while remaining below [Material's recommended 48dp target](https://support.google.com/accessibility/android/answer/7101858?hl=en).
Keep targets separate and their full padding clickable. The webring label
can move above its controls; the contact/status/Feeds row must not stack.

Playlist navigation uses small connected surfaces; Create a series and New writing are prominent
labelled creation actions. Existing selected states, featured project links
and the homepage search field retain their deliberate emphasis.

Do not shrink, rotate, translate, or resize the semantic target when pressed.
Animate the visible corner radius and state layer instead. For a pill, use
half its visible height as the radius; oversized values such as `999px` hide
short-press shape feedback. Disabled actions remain unavailable through native
semantics or their guarded handler, and receive no hover or press feedback.

Keyboard focus supplies one visible 3px outline, offset by 3px, and a focus
state layer. It does not imply a press, selection, or expanded menu. Focus
indicators appear immediately and disappear when focus leaves; do not animate
an outline from `none` to a solid resting outline. Preserve forced-color focus.

Persistent `aria-pressed`, `aria-selected`, and `aria-expanded` states remain
separate from transient focus and press. In particular, focusing a toggle must
not make it look selected. Inputs, editor selections, and active descendants
keep their native or documented component-specific focus behavior.

## Connected groups and containers

[Connected button groups](https://m3.material.io/components/button-groups/specs)
use 2px inner spacing and 8px inner corners at the small size. Only the pressed
control changes shape; neighboring controls retain their position and size.
The spacing is a documented exception to the site's normal 4px layout grid.

Cards and inline links are not automatically buttons. Preserve the site's
personalized card motion and use one focus indicator for each actual action.
Inline destinations remain visibly recognizable links. Do not add a second
ring to artwork inside a focused card.

A page or dialog container retains its resting shape when navigating between
items inside it. Opening and closing can use the documented container
transition. Transition snapshots must retain the same radius and clipping as
the live container.

## Motion and verification

Control motion consumes shared effect and shape tokens. The CSS spring curve
has a cubic-bezier fallback. Reduced motion preserves immediate pressed,
selected, and focus feedback while removing animated and geometric motion.
The core contract works without JavaScript and introduces no content delay.

Check actual pointer holds, keyboard focus and Space activation, release and
focus restoration, disabled controls, confirmed selection, reduced motion,
and JavaScript-disabled navigation. Inspect full mobile and desktop viewports
in both themes; sample transitions rather than only their final frames.
