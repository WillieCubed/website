import { brandSeeds } from '@/lib/brand/scheme';
import { type Entry, entries, products } from '@/lib/home/ventures';

import type { EntityCard } from './types';

/** The homepage URL that opens an entry's detail view. */
export function detailHref(id: string): string {
  return `/?detail=${id}`;
}

/**
 * A detail view's screenshot, when it has one that survives the card's 2:1
 * crop. Portraits, stacks, and the countdown leave the card without a cover.
 */
function coverOf(entry: Entry): EntityCard['cover'] {
  const media = entry.detail.media;
  if (media.kind !== 'image' || media.width <= media.height) return undefined;
  return { src: media.src, alt: media.alt };
}

/**
 * The homepage ventures and studio products, one card per detail view.
 * Hidden ventures are already left out of `entries`, so they get no card, and
 * site search, which reads the same `entries`, gives them no result either.
 */
export const VENTURE_CARDS: EntityCard[] = Object.values(entries).map(
  (entry): EntityCard => ({
    href: detailHref(entry.id),
    kind: entry.id in products ? 'product' : 'venture',
    title: entry.name,
    description: entry.detail.body[0] ?? '',
    cover: coverOf(entry),
    brand: brandSeeds[entry.brand]?.hex,
    meta: entry.parent,
  })
);
