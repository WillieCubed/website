import {
  Hct,
  SchemeFidelity,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';
import type { CSSProperties } from 'react';

/**
 * Material 3 roles an initiative page reads, as CSS custom properties.
 *
 * The homepage uses the same role set for venture tiles. Fidelity keeps the
 * seed as the primary, which is why it was chosen over Expressive
 * (docs/design-principles.md, Brand).
 */
const ROLES = {
  '--b-primary': 'primary',
  '--b-on-primary': 'onPrimary',
  '--b-primary-container': 'primaryContainer',
  '--b-on-primary-container': 'onPrimaryContainer',
  '--b-secondary-container': 'secondaryContainer',
  '--b-surface-container-low': 'surfaceContainerLow',
  '--b-surface-container': 'surfaceContainer',
  '--b-surface-container-high': 'surfaceContainerHigh',
  '--b-on-surface': 'onSurface',
  '--b-on-surface-variant': 'onSurfaceVariant',
  '--b-outline-variant': 'outlineVariant',
} as const;

export type BrandStyle = CSSProperties & Record<`--b-${string}`, string>;

/**
 * Builds inline custom properties for a `#rrggbb` seed. Returns an empty
 * object for a missing seed so the element stays neutral.
 */
export function schemeStyleFromHex(hex: string | undefined): BrandStyle {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return {} as BrandStyle;
  const scheme = new SchemeFidelity(Hct.fromInt(argbFromHex(hex)), false, 0);
  const style = {} as BrandStyle;
  for (const [property, role] of Object.entries(ROLES)) {
    style[property as `--b-${string}`] = hexFromArgb(
      scheme[role as keyof SchemeFidelity] as number
    );
  }
  return style;
}
