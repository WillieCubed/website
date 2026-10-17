import { getGlobalActivityFeedItems } from '@/lib/indieweb/activity-feed-data';
import { activityFeedChannel } from '@/lib/indieweb/feeds/index';
import { activityFeedResponse } from '@/lib/indieweb/feeds/response';

/** Return recent public reactions and replies across the site as RSS. */
export async function GET() {
  return activityFeedResponse(
    'rss',
    await getGlobalActivityFeedItems(),
    activityFeedChannel('rss')
  );
}
