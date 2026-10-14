import { generateTagJsonFeed } from '@/lib/indieweb/feeds/index';
import { getTagFeedItems } from '@/lib/indieweb/feeds/items';
import { webSubLinkHeader } from '@/lib/indieweb/websub-discovery';
import { absoluteRoute } from '@/lib/site/urls';
import { getTagParams } from '@/lib/writings/index';
import { tagFeedPaths, tagFromParam } from '@/lib/writings/tags';

export async function generateStaticParams() {
  return getTagParams();
}

async function buildTagFeed(tag: string) {
  const items = await getTagFeedItems(tag);
  return items.length > 0 ? generateTagJsonFeed(tag, items) : null;
}

/**
 * Return published writings carrying the requested tag, newest first, as
 * JSON Feed. Return 404 when the tag has no public writings.
 */
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
