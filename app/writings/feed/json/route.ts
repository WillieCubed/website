import { cacheLife } from 'next/cache';

import { generateWritingsJsonFeed } from '@/lib/indieweb/feeds/index';
import { getWritingFeedItems } from '@/lib/indieweb/feeds/items';
import { webSubLinkHeader } from '@/lib/indieweb/websub-discovery';
import { absoluteRoute } from '@/lib/site/urls';

async function buildWritingsFeed() {
  'use cache';
  cacheLife('hours');

  return generateWritingsJsonFeed(await getWritingFeedItems());
}

/** Return published writings, newest first, as JSON Feed. */
export async function GET() {
  const feed = await buildWritingsFeed();

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      Link: webSubLinkHeader(absoluteRoute`/writings/feed/json`),
    },
  });
}
