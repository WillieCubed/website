import { tagFeedChannel } from '@/lib/indieweb/feeds/index';
import { getTagFeedItems } from '@/lib/indieweb/feeds/items';
import { feedResponse } from '@/lib/indieweb/feeds/response';
import { getTagParams } from '@/lib/writings';
import { tagFromParam } from '@/lib/writings/tags';

export async function generateStaticParams() {
  return getTagParams();
}

/**
 * Return published writings carrying the requested tag, newest first, as
 * JSON Feed. Return 404 when the tag has no public writings.
 */
export async function GET(
  _request: Request,
  props: RouteContext<'/writings/tags/[tag]/feed/json'>
) {
  const tag = tagFromParam((await props.params).tag);
  const items = await getTagFeedItems(tag);
  if (items.length === 0) return new Response('Not found', { status: 404 });
  return feedResponse('json', items, tagFeedChannel(tag, 'json'));
}
