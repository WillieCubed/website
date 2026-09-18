import {
  Hct,
  MaterialDynamicColors,
  SchemeFidelity,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

import seeds from './seeds.json';

/** A venture whose site the resolver script has read for a brand color. */
export type BrandKey = keyof typeof seeds;

export interface BrandSeed {
  hex: string;
  /** Where on the venture's site the resolver found the color. */
  source: string;
}

export const brandSeeds: Record<BrandKey, BrandSeed> = seeds;

// Fidelity keeps each brand color as the scheme's primary. The Expressive
// variant rotates the primary hue, which turned LVBT's orange into blue.
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

const kebab = (role: string) =>
  role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const cache = new Map<string, Record<string, string>>();

/**
 * The CSS custom properties (`--b-primary`, `--b-on-surface`, and so on) for
 * a venture's Material 3 light scheme, ready to spread into an inline style.
 *
 * A key with no seed returns an empty object so the element stays neutral.
 */
export function brandVars(brandKey: string): Record<string, string> {
  const cached = cache.get(brandKey);
  if (cached) return cached;
  const seed = (brandSeeds as Record<string, BrandSeed | undefined>)[brandKey];
  if (!seed) return {};
  const scheme = new SchemeFidelity(
    Hct.fromInt(argbFromHex(seed.hex)),
    false,
    0
  );
  const vars = Object.fromEntries(
    BRAND_ROLES.map((role: BrandRole) => [
      `--b-${kebab(role)}`,
      hexFromArgb(MaterialDynamicColors[role].getArgb(scheme)),
    ])
  );
  cache.set(brandKey, vars);
  return vars;
}

/** Brand vars for every seeded venture, keyed by brand. */
export function allBrandVars(): Record<BrandKey, Record<string, string>> {
  return Object.fromEntries(
    (Object.keys(brandSeeds) as BrandKey[]).map((key) => [key, brandVars(key)])
  ) as Record<BrandKey, Record<string, string>>;
}
