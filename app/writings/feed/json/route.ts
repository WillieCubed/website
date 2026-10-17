import { writingsFeedChannel } from '@/lib/indieweb/feeds/index';
import { getWritingFeedItems } from '@/lib/indieweb/feeds/items';
import { feedResponse } from '@/lib/indieweb/feeds/response';

/** Return published writings, newest first, as JSON Feed. */
export async function GET() {
  return feedResponse(
    'json',
    await getWritingFeedItems(),
    writingsFeedChannel('json')
  );
}
