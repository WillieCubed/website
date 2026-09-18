import { globalActivityFeedConfig } from '@/lib/indieweb/activity-feed-config';
import { getGlobalActivityFeedItems } from '@/lib/indieweb/activity-feed-data';
import { createActivityFeedResponse } from '@/lib/indieweb/activity-feed-route';

export async function GET() {
  const items = await getGlobalActivityFeedItems();

  return createActivityFeedResponse({
    items,
    format: 'json',
    config: globalActivityFeedConfig('json'),
  });
}
