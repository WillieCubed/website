import { cacheLife } from 'next/cache';

import { generateAtomFeed } from '@/lib/indieweb/feeds/index';
import { getSiteFeedItems } from '@/lib/indieweb/feeds/items';

async function buildFeed() {
  'use cache';
  cacheLife('hours');

  return generateAtomFeed(await getSiteFeedItems());
}

/**
 * Return published writings, dated initiatives, and projects, newest first,
 * as Atom.
 */
export async function GET() {
  const feed = await buildFeed();

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
