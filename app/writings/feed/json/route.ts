import { cacheLife } from 'next/cache';

import { generateWritingsJsonFeed } from '@/lib/feeds';
import { getWritingFeedItems } from '@/lib/feeds/items';

async function buildWritingsFeed() {
  'use cache';
  cacheLife('hours');

  return generateWritingsJsonFeed(await getWritingFeedItems());
}

export async function GET() {
  const feed = await buildWritingsFeed();

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
