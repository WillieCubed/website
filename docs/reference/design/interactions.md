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

Icon-only footer destinations use compact inline targets: 32px wide by 48px tall,
with 32px visible webring surfaces. Profile links narrow to 24px wide in
footer columns of 340px or less. This is a deliberate density exception to
the 48px-square action targets above; each link still meets the
[WCAG 2.2 AA target minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
Targets do not overlap, and status text truncates before the row wraps.
Feeds and other action controls retain their larger targets. Do not apply
this footer link density to action buttons elsewhere.

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
