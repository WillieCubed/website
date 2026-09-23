import { cacheLife } from 'next/cache';

import { generateWritingsAtomFeed, writingToFeedItem } from '@/lib/feeds';
import { getAllWritings } from '@/lib/writings';

async function buildWritingsFeed() {
  'use cache';
  cacheLife('hours');

  const writings = await getAllWritings();
  const items = writings
    .map(writingToFeedItem)
    .sort((a, b) => b.published.getTime() - a.published.getTime());

  return generateWritingsAtomFeed(items);
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
