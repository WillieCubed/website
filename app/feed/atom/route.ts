import { cacheLife } from 'next/cache';

import { generateAtomFeed } from '@/lib/feeds';
import { getSiteFeedItems } from '@/lib/feeds/items';

async function buildFeed() {
  'use cache';
  cacheLife('hours');

  return generateAtomFeed(await getSiteFeedItems());
}

export async function GET() {
  const feed = await buildFeed();

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
