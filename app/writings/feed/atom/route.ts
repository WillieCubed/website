import { cacheLife } from 'next/cache';

import { generateWritingsAtomFeed } from '@/lib/feeds';
import { getWritingFeedItems } from '@/lib/feeds/items';

async function buildWritingsFeed() {
  'use cache';
  cacheLife('hours');

  return generateWritingsAtomFeed(await getWritingFeedItems());
}

export async function GET() {
  const feed = await buildWritingsFeed();

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
