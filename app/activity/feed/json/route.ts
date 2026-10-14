import { globalActivityFeedConfig } from '@/lib/indieweb/activity-feed-config';
import { getGlobalActivityFeedItems } from '@/lib/indieweb/activity-feed-data';
import { createActivityFeedResponse } from '@/lib/indieweb/activity-feed-route';

/** Return recent public reactions and replies across the site as JSON Feed. */
export async function GET() {
  const items = await getGlobalActivityFeedItems();

  return createActivityFeedResponse({
    items,
    format: 'json',
    config: globalActivityFeedConfig('json'),
  });
}
