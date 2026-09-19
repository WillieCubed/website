import { site } from '@/lib/site';

import type { EntityCard } from './types';

/**
 * Pages that are not generated from content but still deserve a card.
 * Keep the descriptions in sync with each page's metadata. Hover cards and
 * site search both read this list.
 */
export const STATIC_PAGES: EntityCard[] = [
  {
    href: '/',
    kind: 'page',
    title: site.name,
    description: site.shortDescription,
  },
  {
    href: '/initiatives',
    kind: 'page',
    title: 'Initiatives',
    description:
      'The campaigns, series, and projects Willie is running right now.',
  },
  {
    href: '/writings',
    kind: 'page',
    title: 'Writings',
    description:
      'Thoughts, tutorials, and notes on software, music, and creativity.',
  },
];
