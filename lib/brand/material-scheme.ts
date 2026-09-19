import {
  Hct,
  MaterialDynamicColors,
  SchemeFidelity,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

const BRAND_ROLES = [
  'primary',
  'onPrimary',
  'primaryContainer',
  'onPrimaryContainer',
  'secondaryContainer',
  'onSecondaryContainer',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
  'onSurface',
  'onSurfaceVariant',
  'outlineVariant',
] as const;

type BrandRole = (typeof BRAND_ROLES)[number];
export type BrandSchemeVars = Record<`--b-${string}`, string>;

const kebab = (role: string) =>
  role.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);

/**
 * Builds one adaptive Material role set from a brand seed. `light-dark()`
 * leaves scheme selection to the same `color-scheme` boundary as the site.
 */
export function materialSchemeVars(hex: string): BrandSchemeVars {
  const source = Hct.fromInt(argbFromHex(hex));
  const light = new SchemeFidelity(source, false, 0);
  const dark = new SchemeFidelity(source, true, 0);

  return Object.fromEntries(
    BRAND_ROLES.map((role: BrandRole) => {
      const lightValue = hexFromArgb(
        MaterialDynamicColors[role].getArgb(light)
      );
      const darkValue = hexFromArgb(MaterialDynamicColors[role].getArgb(dark));
      return [`--b-${kebab(role)}`, `light-dark(${lightValue}, ${darkValue})`];
    })
  ) as BrandSchemeVars;
}
