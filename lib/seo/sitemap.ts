import type { MetadataRoute } from 'next';

import type { Initiative } from '@/lib/initiatives';
import { canonicalUrl, routedPages } from '@/lib/site';
import type { WritingData } from '@/lib/writings';

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
}): MetadataRoute.Sitemap {
  const initiatives = input.initiatives
    .filter((item) => !item.draft)
    .flatMap((item) => [
      entry(item.href, item.updated),
      ...item.parts
        .filter((part) => !part.draft)
        .map((part) => entry(`${item.href}/${part.slug}`, part.updated)),
    ]);
  const writings = input.writings
    .filter((item) => !item.draft)
    .map((item) => entry(`/writings/${item.slug}`, item.lastUpdated));
  return [
    entry('/'),
    ...routedPages.map((page) => entry(page.path)),
    ...initiatives,
    ...writings,
  ];
}
