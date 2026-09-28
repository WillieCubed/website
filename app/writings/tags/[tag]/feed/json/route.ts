import { cacheLife } from 'next/cache';

import { generateTagJsonFeed } from '@/lib/feeds';
import { getTagFeedItems } from '@/lib/feeds/items';
import { webSubLinkHeader } from '@/lib/indieweb/websub-discovery';
import { absoluteRoute } from '@/lib/site';
import { getTagParams } from '@/lib/writings';
import { tagFeedPaths, tagFromParam } from '@/lib/writings/tags';

export async function generateStaticParams() {
  return getTagParams();
}

async function buildTagFeed(tag: string) {
  'use cache';
  cacheLife('hours');

  const items = await getTagFeedItems(tag);
  return items.length > 0 ? generateTagJsonFeed(tag, items) : null;
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ tag: string }> }
) {
  const tag = tagFromParam((await props.params).tag);
  const feed = await buildTagFeed(tag);
  if (!feed) return new Response('Not found', { status: 404 });

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/feed+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      Link: webSubLinkHeader(absoluteRoute`${tagFeedPaths(tag).json}`),
    },
  });
}
