import { cacheLife } from 'next/cache';

import { generateWritingsRssFeed } from '@/lib/indieweb/feeds/index';
import { getWritingFeedItems } from '@/lib/indieweb/feeds/items';

async function buildWritingsFeed() {
  'use cache';
  cacheLife('hours');

  return generateWritingsRssFeed(await getWritingFeedItems());
}

/** Return published writings, newest first, as RSS. */
export async function GET() {
  const feed = await buildWritingsFeed();

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
