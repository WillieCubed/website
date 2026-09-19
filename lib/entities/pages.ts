import { routedPages, site } from '@/lib/site';

import type { EntityCard } from './types';

/**
 * Pages that are not generated from content but still deserve a card: the
 * homepage and every routed page in the site manifest. Titles and
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
];
