import { materialSchemeVars } from './material-scheme';
import seeds from './seeds.json';

/** A venture whose site the resolver script has read for a brand color. */
export type BrandKey = keyof typeof seeds;

export interface BrandSeed {
  hex: string;
  /** Where on the venture's site the resolver found the color. */
  source: string;
}

export const brandSeeds: Record<BrandKey, BrandSeed> = seeds;

const cache = new Map<string, Record<string, string>>();

/**
 * The CSS custom properties (`--b-primary`, `--b-on-surface`, and so on) for
 * a venture's adaptive Material 3 scheme, ready to spread into an inline style.
 *
 * A key with no seed returns an empty object so the element stays neutral.
 */
export function brandVars(brandKey: string): Record<string, string> {
  const cached = cache.get(brandKey);
  if (cached) return cached;
  const seed = (brandSeeds as Record<string, BrandSeed | undefined>)[brandKey];
  if (!seed) return {};
  const vars = materialSchemeVars(seed.hex);
  cache.set(brandKey, vars);
  return vars;
}

/** Brand vars for every seeded venture, keyed by brand. */
export function allBrandVars(): Record<BrandKey, Record<string, string>> {
  return Object.fromEntries(
    (Object.keys(brandSeeds) as BrandKey[]).map((key) => [key, brandVars(key)])
  ) as Record<BrandKey, Record<string, string>>;
}
