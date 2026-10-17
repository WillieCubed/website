import { getActivityFeedItemsForPost } from '@/lib/indieweb/activity-feed-data';
import { activityFeedChannel } from '@/lib/indieweb/feeds/index';
import { activityFeedResponse } from '@/lib/indieweb/feeds/response';
import { getPublishedWriting } from '@/lib/writings/index';

/**
 * Return reactions and replies to this published writing as RSS.
 * Return 404 for a draft or missing writing.
 */
export async function GET(
  _request: Request,
  props: RouteContext<'/writings/[slug]/activity/feed.xml'>
) {
  const { slug } = await props.params;
  // A draft or missing writing has no public activity to syndicate.
  const published = await getPublishedWriting(slug).catch(() => null);
  if (!published) return new Response('Not found', { status: 404 });
  return activityFeedResponse(
    'rss',
    await getActivityFeedItemsForPost(slug),
    activityFeedChannel('rss', slug)
  );
}
