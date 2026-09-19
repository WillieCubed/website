import { cacheLife } from 'next/cache';

import { getInitiatives } from '@/lib/initiatives';
import { formatDate, routedPages, site } from '@/lib/site';
import { getAllWritings } from '@/lib/writings';

import type { EntityCard } from './types';

export type { EntityCard };

/**
 * Pages that are not generated from content but still deserve a card:
 * the homepage and every routed page in the site manifest.
 */
const STATIC_PAGES: EntityCard[] = [
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

function range(starts: Date, ends: Date) {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: site.timeZone,
    month: 'short',
    day: 'numeric',
  });
  return `${short.format(starts)} – ${short.format(ends)}`;
}

/**
 * Every entity on the site, keyed by path, for hover cards and social
 * images. Cached for an hour like the loaders it reads from.
 */
export async function getEntityRegistry(): Promise<EntityCard[]> {
  'use cache';
  cacheLife('hours');

  const [writings, initiatives] = await Promise.all([
    getAllWritings(false),
    getInitiatives(),
  ]);

  const cards: EntityCard[] = [...STATIC_PAGES];

  for (const writing of writings) {
    cards.push({
      href: `/writings/${writing.slug}`,
      kind: 'writing',
      title: writing.title,
      description: writing.description,
      cover: writing.featuredImage
        ? { src: writing.featuredImage, alt: writing.featuredImageAlt ?? '' }
        : undefined,
      meta: `${formatDate(new Date(writing.published))} · ${writing.readingTime} min read`,
    });
  }

  for (const initiative of initiatives) {
    const brand = initiative.brand?.startsWith('#')
      ? initiative.brand
      : undefined;
    cards.push({
      href: initiative.href,
      kind: 'initiative',
      title: initiative.title,
      description: initiative.tagline,
      cover: initiative.cover,
      brand,
      meta:
        initiative.starts && initiative.ends
          ? range(initiative.starts, initiative.ends)
          : undefined,
    });
    for (const part of initiative.parts) {
      cards.push({
        href: `${initiative.href}/${part.slug}`,
        kind: 'part',
        title: part.title,
        description: part.tagline ?? part.description ?? initiative.tagline,
        cover: part.cover ?? initiative.cover,
        brand,
        meta: `${initiative.partLabel} ${part.number} of ${initiative.parts.length} · ${range(part.starts, part.ends)}`,
      });
    }
  }

  return cards;
}

export { entityKey } from './key';
