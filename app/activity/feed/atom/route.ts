import { globalActivityFeedConfig } from '@/lib/indieweb/activity-feed-config';
import { getGlobalActivityFeedItems } from '@/lib/indieweb/activity-feed-data';
import { createActivityFeedResponse } from '@/lib/indieweb/activity-feed-route';

export async function GET() {
  const items = await getGlobalActivityFeedItems();

  return createActivityFeedResponse({
    items,
    format: 'atom',
    config: globalActivityFeedConfig('atom'),
  });
}
