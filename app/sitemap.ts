import { MetadataRoute } from 'next';

import { getAllProjects } from '@/lib/projects';
import { siteRoute } from '@/lib/url-utils';
import { getAllWritings } from '@/lib/writings';

/**
 * Generates the sitemap for the whole website.
 *
 * This includes:
 * - My projects
 * - My writings
 * - All other public pages
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getAllProjects();
  const projectItems = projects.map((project) => ({
    url: siteRoute`/projects/${project.codename}`,
    changeFrequency: 'monthly',
    priority: 0.75,
  }));
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
      url: siteRoute`/about`,
      changeFrequency: 'yearly',
      priority: 0.75,
    },
    {
      url: siteRoute`/contact`,
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: siteRoute`/projects`,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: siteRoute`/apps`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: siteRoute`/research`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    {
      url: siteRoute`/now`,
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: siteRoute`/design`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: siteRoute`/writings`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: siteRoute`/media`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: siteRoute`/hi`,
      changeFrequency: 'yearly',
      priority: 0.2,
    },
    ...projectItems,
    ...writingItems,
  ] as MetadataRoute.Sitemap; // Because the mapped item lists are not typed as MetadataRoute.SitemapItem[] for some reason
}
