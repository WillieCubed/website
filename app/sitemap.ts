import type { MetadataRoute } from 'next';

import { getInitiatives } from '@/lib/initiatives';
import { buildSitemap } from '@/lib/seo/sitemap';
import { getAllWritings } from '@/lib/writings';

/**
 * Generates the sitemap for the whole website.
 *
 * Only routed pages belong here. Pages parked in app/_(pages) are left
 * out until they are rebuilt and routed again.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [initiatives, writings] = await Promise.all([
    getInitiatives(),
    getAllWritings(),
  ]);
  return buildSitemap({ initiatives, writings });
}
