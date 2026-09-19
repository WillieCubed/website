import type { Viewport } from 'next';

import { getInitiative } from './index';

/**
 * Only a `#rrggbb` brand can be a theme colour. A seed key or no brand
 * leaves the site colour set in the root layout.
 */
export function viewportForBrand(brand: string | undefined): Viewport {
  return brand && /^#[0-9a-fA-F]{6}$/.test(brand) ? { themeColor: brand } : {};
}

/** Tints the browser chrome with an initiative's brand colour. */
export async function initiativeViewport(slug: string): Promise<Viewport> {
  const initiative = await getInitiative(slug).catch(() => null);
  return viewportForBrand(initiative?.brand);
}
