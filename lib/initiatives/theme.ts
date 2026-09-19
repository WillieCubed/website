import type { CSSProperties } from 'react';

import { materialSchemeVars } from '@/lib/brand/material-scheme';

/**
 * Material 3 roles an initiative page reads, as CSS custom properties.
 *
 * The homepage uses the same role set for venture tiles. Fidelity keeps the
 * seed as the primary, which is why it was chosen over Expressive
 * (docs/design-principles.md, Brand).
 */
export type BrandStyle = CSSProperties & Record<`--b-${string}`, string>;

/**
 * Builds inline custom properties for a `#rrggbb` seed. Returns an empty
 * object for a missing seed so the element stays neutral.
 */
export function schemeStyleFromHex(hex: string | undefined): BrandStyle {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return {} as BrandStyle;
  return materialSchemeVars(hex) as BrandStyle;
}
