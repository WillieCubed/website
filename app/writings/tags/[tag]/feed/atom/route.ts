import { cacheLife } from 'next/cache';

import { generateTagAtomFeed } from '@/lib/indieweb/feeds/index';
import { getTagFeedItems } from '@/lib/indieweb/feeds/items';
import { getTagParams } from '@/lib/writings/index';
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

/**
 * Return published writings carrying the requested tag, newest first, as
 * Atom. Return 404 when the tag has no public writings.
 */
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
