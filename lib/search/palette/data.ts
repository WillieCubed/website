import { cacheLife } from 'next/cache';

import { detailHref } from '@/lib/entities/ventures';
import { entries, products } from '@/lib/home/ventures';
import { type Initiative, getInitiatives } from '@/lib/initiatives/index';
import { currentPart } from '@/lib/initiatives/load';
import { formatDate } from '@/lib/site/dates';
import { type WritingData, getAllWritings } from '@/lib/writings/index';

import type { PaletteData, PaletteLink } from './types';

/**
 * Load palette navigation data from the page loaders and cache it for an
 * hour. The palette endpoint reads this data when the dialog first opens.
 */
export async function getPaletteData(): Promise<PaletteData> {
  'use cache';
  cacheLife('hours');

  // The loaders hide drafts in production and show them in development,
  // so the palette lists the same pages the site itself links to.
  const [writings, initiatives] = await Promise.all([
    getAllWritings(),
    getInitiatives(),
  ]);
  return paletteData(writings, initiatives);
}

/**
 * The palette's data from loaded writings and initiatives. Kept apart from
 * the cached loader so it runs under plain Node in tests.
 */
export function paletteData(
  writings: WritingData[],
  initiatives: Initiative[]
): PaletteData {
  const writingLinks: PaletteLink[] = writings.map((writing) => ({
    title: writing.title,
    href: `/writings/${writing.slug}`,
    detail: formatDate(writing.published, 'short'),
  }));

  // Initiatives arrive newest first, so the first one with a part is the
  // one running now or coming up next.
  let current: PaletteLink | undefined;
  for (const initiative of initiatives) {
    const part = currentPart(initiative);
    if (!part) continue;
    current = {
      title: `${initiative.partLabel} ${part.number}: ${part.title}`,
      href: `${initiative.href}/${part.slug}`,
      detail: initiative.title,
    };
    break;
  }

  return {
    latestWriting: writingLinks[0],
    currentPart: current,
    writings: writingLinks,
    initiatives: initiatives.map((initiative) => ({
      title: initiative.title,
      href: initiative.href,
      detail: initiative.tagline,
    })),
    ventures: Object.values(entries).map((entry) => ({
      title: entry.name,
      href: detailHref(entry.id),
      detail: entry.id in products ? 'Studio product' : 'Venture',
    })),
  };
}
