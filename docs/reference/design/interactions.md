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

Breadcrumb menu triggers use the same separate surface with equal padding on
all four sides: 8px normally and 4px on phones at or below 360px. Their full
48px touch targets remain clickable around the shorter visible surface.
The home-name link uses the same shared hover, pressed, focus, and reduced-motion
states, with its original compact horizontal footprint and 48px target height.

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
horizontally when necessary, keeping every displayed link reachable by touch and keyboard.
Compact footers prioritize Email, Instagram, LinkedIn, and GitHub; secondary profiles appear at wider widths.
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

Every page uses the same scroll-driven transition into its footer. The surface
starts at viewport width, then narrows and rounds its lower corners while the
contents reflow naturally without scaling. Its expanded inset is 8px per side on phones
and 16px on desktop, independently of the page's content width or length.
The primary surface has a minimum height of one small viewport, including empty
collections, so the footer begins below it instead of consuming its first screen.
Short pages use the same inset when scrolled to the footer. Header, main,
and footer content retain their shared width cap inside these viewport surfaces. The sheet changes its actual layout
width, moving and reflowing its contents without scaling text or tiles; clipping
only rounds and trims the lower edge. Scrolling back above the footer restores the full-width
surface. The sheet and tray remain opaque throughout. Sheet progress excludes height
added by the narrowing itself, so a long document cannot alternate between wide
and narrow layouts at one scroll position. Actual footer visibility still governs
docking and keyboard availability. Resting-width measurements preserve the scroll
extent until the real width is restored, keeping the viewport in place.

`styles/frames.css` defines the shared page widths and gutters. The header,
primary content (`site-frame`), and footer all use the active page's frame.
The existing top-bar registration supplies that frame across client navigation;
CSS supplies the first paint and no-JavaScript fallback. The surface inset does not depend on these caps. The homepage retains
its wider work layout, content pages use 840px, reading pages use 768px, and
wide pages use 1200px.

The homepage and Status page request the compact contact dock. Other footers
retain normal document flow. The contact/status/Feeds row has 40px of space above it, with the
webrings retaining their separate compact gap. Profile artwork is centered with
its longer dimension at 20px inside 24px SVG boxes, using viewBox padding rather
than CSS scale transforms; their larger touch targets and icon-only zero-gap
layout remain unchanged. On narrow phones, touch padding can hang into the
existing side gutter. Keep the priority targets complete: two at 320px and three
at 390px for the default city; remaining profiles scroll horizontally. This uses
existing room without adding mobile padding or reducing the 44px targets.
The mobile webring label aligns with the navigation text above and sits on the
same line as all six controls. The two three-link groups keep a fixed 4px gap
rather than spreading to fill available width. Below 600px, the complete strip
scrolls horizontally when necessary: the label and controls never wrap, and all
six targets retain their 44px width and height. Keyboard focus scrolls each
target fully into view. Desktop retains its label above two stacked triplets.
Arrows, the compass, and Feeds use native 20px Material Symbols Rounded glyphs at
weight 400 and grade 0; brand marks retain their original artwork. The frame
retains its 8px padding; alignment is measured from the visible label, not its
outline or the larger native targets.
Reduced motion keeps a static
rounded ending. Short pages and footers taller than the viewport retain natural
layout, and all content and links work without JavaScript.

The footer cube's drawing aligns with the text edge. Its native touch padding
hangs outside that line; alignment must not be measured from the button border.

After visitor scrolling brings the footer into view, native CSS `y proximity` snapping
can settle the document at its end. The browser controls its distance and timing;
the single endpoint does not force a stop or intercept scrolling. It is outside
the sticky homepage footer, hidden from assistive technology, and enabled only
following a wheel, touch-scroll, or scrolling-key gesture that moves the viewport.
Reloads and restored history positions do not activate snapping on their own. It is disabled for
reduced motion, short static pages, and footers taller than the viewport.

The controller resets when the active page header, column, or dock mode changes and remeasures
content during client navigation. `footer-shape.spec.mts` checks painted surface
edges and unchanged content scale; `page-footer-motion.spec.mts` checks intermediate
states, reverse scrolling, navigation, and fallbacks. `footer-snap.spec.mts` uses
wheel input to check settling, scrolling away again, and no movement on page load.

The status link groups location, time, and weather in one quiet tonal
capsule using the surface-container role. Keep at least 12px of horizontal
padding (12px in compact footers, 16px when roomy); optional metadata yields before padding does.
The compact weather condition icon remains visible on mobile. At legacy
narrow widths, artwork yields after the clock; the city stays readable. Omit the visible Fahrenheit suffix while retaining
the degree symbol and the full accessible reading. Feeds uses a
circular shape when icon-only and a capsule when labelled, with the shared
pressed shape and focus treatment.

Webrings use 44px-square native targets with 32px visible surfaces, an
outlined group, and tonal directory links. Compact footer link sizing meets
[WCAG's enhanced target-size criterion](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)
while remaining below [Material's recommended 48dp target](https://support.google.com/accessibility/android/answer/7101858?hl=en).
Keep targets separate and their full padding clickable. The webring label
can move above its controls and keeps an 8px inset from the group's border on
phones; the contact/status/Feeds row must not stack.
The outlined webring group follows the navigation's content edge on phones.
When both ring triplets cannot fit, the triplets wrap within that frame while
keeping their 44px targets; the group does not break out toward the viewport edge.

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
