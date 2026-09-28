import { cacheLife } from 'next/cache';

import { generateTagAtomFeed } from '@/lib/feeds';
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
  return items.length > 0 ? generateTagAtomFeed(tag, items) : null;
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ tag: string }> }
) {
  const feed = await buildTagFeed(tagFromParam((await props.params).tag));
  if (!feed) return new Response('Not found', { status: 404 });

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
