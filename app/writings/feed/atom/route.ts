import { cacheLife } from 'next/cache';

import { generateWritingsAtomFeed } from '@/lib/indieweb/feeds/index';
import { getWritingFeedItems } from '@/lib/indieweb/feeds/items';

async function buildWritingsFeed() {
  'use cache';
  cacheLife('hours');

  return generateWritingsAtomFeed(await getWritingFeedItems());
}

/** Return published writings, newest first, as Atom. */
export async function GET() {
  const feed = await buildWritingsFeed();

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
