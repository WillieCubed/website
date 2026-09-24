import { cacheLife } from 'next/cache';

import { detailHref } from '@/lib/entities/ventures';
import { entries, products } from '@/lib/home/ventures';
import {
  type Initiative,
  currentPart,
  getInitiatives,
} from '@/lib/initiatives';
import { formatDate } from '@/lib/site';
import { type WritingData, getAllWritings } from '@/lib/writings';

import type { PaletteData, PaletteLink } from './types';

/**
 * The palette's places, from the same loaders the pages use. Cached for an
 * hour like those loaders, so the root layout can read it for every page
 * without touching the file system on each request.
 */
export async function getPaletteData(): Promise<PaletteData> {
  'use cache';
  cacheLife('hours');

  // The loaders hide drafts in production and show them in development,
  // so the palette offers the same pages the site itself links to.
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
