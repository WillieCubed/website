import { siteFeedChannel } from '@/lib/indieweb/feeds/index';
import { getSiteFeedItems } from '@/lib/indieweb/feeds/items';
import { feedResponse } from '@/lib/indieweb/feeds/response';

/**
 * Return published writings, dated initiatives, and projects, newest first,
 * as RSS.
 */
export async function GET() {
  return feedResponse('rss', await getSiteFeedItems(), siteFeedChannel('rss'));
}
