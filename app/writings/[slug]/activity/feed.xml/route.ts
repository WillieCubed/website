import { writingActivityFeedConfig } from '@/lib/indieweb/activity-feed-config';
import { getActivityFeedItemsForPost } from '@/lib/indieweb/activity-feed-data';
import { createActivityFeedResponse } from '@/lib/indieweb/activity-feed-route';
import type { WritingActivityFeedRouteProps } from '@/lib/indieweb/types';

export async function GET(
  _request: Request,
  props: WritingActivityFeedRouteProps
) {
  const { slug } = await props.params;
  const items = await getActivityFeedItemsForPost(slug);

  return createActivityFeedResponse({
    items,
    format: 'rss',
    config: writingActivityFeedConfig(slug, 'rss'),
  });
}
