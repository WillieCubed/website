import { generateTagRssFeed } from '@/lib/indieweb/feeds/index';
import { getTagFeedItems } from '@/lib/indieweb/feeds/items';
import { getTagParams } from '@/lib/writings';
import { tagFromParam } from '@/lib/writings/tags';

export async function generateStaticParams() {
  return getTagParams();
}

async function buildTagFeed(tag: string) {
  const items = await getTagFeedItems(tag);
  return items.length > 0 ? generateTagRssFeed(tag, items) : null;
}

/**
 * Return published writings carrying the requested tag, newest first, as
 * RSS. Return 404 when the tag has no public writings.
 */
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
