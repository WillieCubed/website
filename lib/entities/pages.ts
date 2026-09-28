import { routedPages, site } from '@/lib/site';

import type { EntityCard } from './types';

/**
 * The search page's card. It is not in `sitePages` because it stays out of
 * the sitemap and the footer, but links to it still deserve a card, so
 * app/search/page.tsx reads its title and description from here.
 */
export const SEARCH_PAGE: EntityCard = {
  href: '/search',
  kind: 'page',
  title: 'Search',
  description: `Search everything on ${new URL(site.origin).hostname}.`,
};

/**
 * Pages that are not generated from content but still deserve a card: the
 * homepage, every routed page in the site manifest, and search. Titles and
 * descriptions come from `sitePages` in lib/site.ts, so a page that is
 * rebuilt and routed again appears here without a second edit. Hover cards
 * and site search both read this list.
 */
export const STATIC_PAGES: EntityCard[] = [
  {
    href: '/',
    kind: 'page',
    title: site.name,
    description: site.shortDescription,
  },
  ...routedPages.map(
    (page): EntityCard => ({
      href: page.path,
      kind: 'page',
      title: page.label,
      description: page.description,
    })
  ),
  SEARCH_PAGE,
];
