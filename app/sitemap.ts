import type { MetadataRoute } from 'next';

import { getInitiatives } from '@/lib/initiatives';
import { getPublishedProjects } from '@/lib/projects';
import { buildSitemap } from '@/lib/seo/sitemap';
import { getAllWritings } from '@/lib/writings';

/**
 * Generates the sitemap for the whole website.
 *
 * Only routed pages belong here. Pages parked in app/_(pages) are left
 * out until they are rebuilt and routed again.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [initiatives, writings, projects] = await Promise.all([
    getInitiatives(),
    getAllWritings(),
    getPublishedProjects(),
  ]);
  return buildSitemap({ initiatives, writings, projects });
}
