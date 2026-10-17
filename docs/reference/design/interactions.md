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

| Size                                  | Minimum target | Pressed corner |
| ------------------------------------- | -------------- | -------------- |
| Small (default)                       | 48px           | 8px            |
| Medium (`data-control-size="medium"`) | 56px           | 12px           |
| Large (`data-control-size="large"`)   | 96px           | 16px           |

These values follow the [button](https://m3.material.io/components/buttons/specs)
and [icon-button](https://m3.material.io/components/icon-buttons/specs) size
scales. Compact icons may remain visually smaller inside the target. Do not
shrink, rotate, translate, or resize the semantic target when it is pressed.
Animate the corner radius and state layer instead. Disabled actions do not
receive hover or pressed feedback and must remain unavailable through their
native semantics or existing guarded handler.

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
