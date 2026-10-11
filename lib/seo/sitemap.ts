import type { MetadataRoute } from 'next';

import type { Initiative } from '@/lib/initiatives';
import type { Project } from '@/lib/projects';
import { canonicalUrl, routedPages } from '@/lib/site';
import type { WritingData } from '@/lib/writings';
import { groupByTag, tagPath } from '@/lib/writings/tags';

type Entry = MetadataRoute.Sitemap[number];

/**
 * An entry under the page's canonical address, with a lastModified only when
 * there is a real edit date to give.
 */
function entry(path: string, lastModified?: Date | string): Entry {
  return lastModified
    ? { url: canonicalUrl(path), lastModified }
    : { url: canonicalUrl(path) };
}

export function publishedSitemapContent(input: {
  writings: WritingData[];
  initiatives: Initiative[];
}) {
  const writings = input.writings
    .filter((item) => !item.draft)
    .sort(
      (a, b) =>
        new Date(b.published).getTime() - new Date(a.published).getTime()
    );
  const initiatives = input.initiatives
    .filter((item) => !item.draft)
    .map((item) => ({
      ...item,
      parts: item.parts
        .filter((part) => !part.draft)
        .sort((a, b) => a.number - b.number),
    }));
  return { writings, initiatives, topics: groupByTag(writings) };
}

/**
 * The sitemap for the routed pages. Google ignores `changeFrequency` and
 * `priority`, and it stops trusting `lastModified` once a site gets it wrong,
 * so dates come only from an edit date the content carries and never from an
 * event's own dates. Drafts are dropped here as well as in the loaders.
 *
 * The top-level pages come from `sitePages` in lib/site.ts, so a page that is
 * parked in app/_(pages) stays out of the sitemap until its `routed` flag
 * flips back.
 */
export function buildSitemap(input: {
  writings: WritingData[];
  initiatives: Initiative[];
  projects?: Project[];
}): MetadataRoute.Sitemap {
  const published = publishedSitemapContent(input);
  const initiatives = published.initiatives.flatMap((item) => [
    entry(item.href, item.updated),
    ...item.parts.map((part) =>
      entry(`${item.href}/${part.slug}`, part.updated)
    ),
  ]);
  const writings = published.writings.map((item) =>
    entry(`/writings/${item.slug}`, item.lastUpdated)
  );
  // Undated like /writings, which lists the same entries.
  const tags = published.topics.map(({ tag }) => entry(tagPath(tag)));
  return [
    entry('/'),
    ...routedPages.map((page) => entry(page.path)),
    ...initiatives,
    ...writings,
    ...tags,
    ...(input.projects ?? [])
      .filter((project) => !project.draft && project.visibility !== 'hidden')
      .map((project) => entry(project.href, project.updated)),
  ];
}
