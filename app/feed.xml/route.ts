import { cacheLife } from 'next/cache';

import { generateRssFeed } from '@/lib/indieweb/feeds/index';
import { getSiteFeedItems } from '@/lib/indieweb/feeds/items';

async function buildFeed() {
  'use cache';
  cacheLife('hours');

  return generateRssFeed(await getSiteFeedItems());
}

/**
 * Return published writings, dated initiatives, and projects, newest first,
 * as RSS.
 */
export async function GET() {
  const feed = await buildFeed();

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
