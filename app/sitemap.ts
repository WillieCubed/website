import type { MetadataRoute } from 'next';

import { getInitiatives } from '@/lib/initiatives/index';
import { getPublishedProjects } from '@/lib/projects';
import { buildSitemap } from '@/lib/seo/sitemap';
import { getAllWritings } from '@/lib/writings/index';

/**
 * Return canonical URLs and content-derived edit dates for routed pages and
 * published content. Exclude drafts and parked pages.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [initiatives, writings, projects] = await Promise.all([
    getInitiatives(),
    getAllWritings(),
    getPublishedProjects(),
  ]);
  return buildSitemap({ initiatives, writings, projects });
}
