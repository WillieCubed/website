import { writingActivityFeedConfig } from '@/lib/indieweb/activity-feed-config';
import { getActivityFeedItemsForPost } from '@/lib/indieweb/activity-feed-data';
import { createActivityFeedResponse } from '@/lib/indieweb/activity-feed-route';
import { getPublishedWriting } from '@/lib/writings/index';

/**
 * Return reactions and replies to this published writing as JSON Feed.
 * Return 404 for a draft or missing writing.
 */
export async function GET(
  _request: Request,
  props: RouteContext<'/writings/[slug]/activity/feed/json'>
) {
  const { slug } = await props.params;
  // A draft or missing writing has no public activity to syndicate.
  const published = await getPublishedWriting(slug).catch(() => null);
  if (!published) return new Response('Not found', { status: 404 });
  const items = await getActivityFeedItemsForPost(slug);

  return createActivityFeedResponse({
    items,
    format: 'json',
    config: writingActivityFeedConfig(slug, 'json'),
  });
}
