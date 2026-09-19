import { writingActivityFeedConfig } from '@/lib/indieweb/activity-feed-config';
import { getActivityFeedItemsForPost } from '@/lib/indieweb/activity-feed-data';
import { createActivityFeedResponse } from '@/lib/indieweb/activity-feed-route';
import type { WritingActivityFeedRouteProps } from '@/lib/indieweb/types';
import { getPublishedWriting } from '@/lib/writings';

export async function GET(
  _request: Request,
  props: WritingActivityFeedRouteProps
) {
  const { slug } = await props.params;
  // A draft or missing writing has no public activity to syndicate.
  const published = await getPublishedWriting(slug).catch(() => null);
  if (!published) return new Response('Not found', { status: 404 });
  const items = await getActivityFeedItemsForPost(slug);

  return createActivityFeedResponse({
    items,
    format: 'atom',
    config: writingActivityFeedConfig(slug, 'atom'),
  });
}
