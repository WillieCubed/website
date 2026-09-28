import { cacheLife } from 'next/cache';

import { hasImageDescription } from '@/lib/accessibility/alt-policy';
import { type Initiative, getInitiatives } from '@/lib/initiatives';
import { formatDate, isInternalHref, site } from '@/lib/site';
import { type WritingData, getAllWritings } from '@/lib/writings';

import { entityKey } from './key';
import { STATIC_PAGES } from './pages';
import { tagCards } from './tags';
import type { EntityCard } from './types';
import { VENTURE_CARDS } from './ventures';

export type { EntityCard };

function range(starts: Date, ends: Date) {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: site.timeZone,
    month: 'short',
    day: 'numeric',
  });
  return `${short.format(starts)} – ${short.format(ends)}`;
}

function writingCover(writing: WritingData) {
  if (!writing.featuredImage) return undefined;
  if (!hasImageDescription(writing.featuredImageAlt)) {
    throw new Error(
      `Writing "${writing.slug}" has a featured image without alt text.`
    );
  }
  return { src: writing.featuredImage, alt: writing.featuredImageAlt.trim() };
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
  return entityCards(writings, initiatives);
}

/**
 * Drops in-site links whose destination is not published, such as a chip
 * pointing at a writing that is still a draft. The link comes back on its own
 * once the page ships, so content can name a page before it exists.
 */
export async function publishedLinks<T extends { href: string }>(
  links: T[]
): Promise<T[]> {
  if (!links.some((link) => isInternalHref(link.href))) return links;
  const known = new Set(
    (await getEntityRegistry()).map((card) => entityKey(card.href))
  );
  return links.filter(
    (link) => !isInternalHref(link.href) || known.has(entityKey(link.href))
  );
}

/**
 * The cards for the static pages and ventures plus the given writings, the
 * tags they carry, and initiatives. Kept apart from the cached loader so it
 * runs under plain Node.
 */
export function entityCards(
  writings: WritingData[],
  initiatives: Initiative[]
): EntityCard[] {
  const cards: EntityCard[] = [...STATIC_PAGES, ...VENTURE_CARDS];

  for (const writing of writings) {
    cards.push({
      href: `/writings/${writing.slug}`,
      kind: 'writing',
      title: writing.title,
      description: writing.description,
      cover: writingCover(writing),
      meta: `${formatDate(new Date(writing.published))} · ${writing.readingTime} min read`,
    });
  }
  cards.push(...tagCards(writings));

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
        meta: `${initiative.title} · ${initiative.partLabel} ${part.number} of ${initiative.parts.length} · ${range(part.starts, part.ends)}`,
      });
    }
  }

  return cards;
}

export { entityKey };
