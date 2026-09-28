import { cacheLife } from 'next/cache';

import { generateTagRssFeed } from '@/lib/feeds';
import { getTagFeedItems } from '@/lib/feeds/items';
import { getTagParams } from '@/lib/writings';
import { tagFromParam } from '@/lib/writings/tags';

export async function generateStaticParams() {
  return getTagParams();
}

async function buildTagFeed(tag: string) {
  'use cache';
  cacheLife('hours');

  const items = await getTagFeedItems(tag);
  return items.length > 0 ? generateTagRssFeed(tag, items) : null;
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ tag: string }> }
) {
  const feed = await buildTagFeed(tagFromParam((await props.params).tag));
  if (!feed) return new Response('Not found', { status: 404 });

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}
