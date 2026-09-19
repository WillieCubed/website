import { MetadataRoute } from 'next';

import { getInitiatives } from '@/lib/initiatives';
import { siteRoute } from '@/lib/url-utils';
import { getAllWritings } from '@/lib/writings';

/**
 * Generates the sitemap for the whole website.
 *
 * Only routed pages belong here. Pages parked in app/_(pages) are left
 * out until they are rebuilt and routed again.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const initiatives = await getInitiatives();
  const initiativeItems = initiatives.flatMap((initiative) => [
    {
      url: siteRoute`${initiative.href}`,
      lastModified: initiative.ends,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...initiative.parts.map((part) => ({
      url: siteRoute`${initiative.href}/${part.slug}`,
      lastModified: part.ends,
      changeFrequency: 'weekly',
      priority: 0.8,
    })),
  ]);
  const writings = await getAllWritings();
  const writingItems = writings.map((writing) => ({
    url: siteRoute`/writings/${writing.slug}`,
    lastModified: writing.lastUpdated,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));
  return [
    {
      url: siteRoute`/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: siteRoute`/writings`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: siteRoute`/initiatives`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...initiativeItems,
    ...writingItems,
  ] as MetadataRoute.Sitemap; // Because the mapped item lists are not typed as MetadataRoute.SitemapItem[] for some reason
}
