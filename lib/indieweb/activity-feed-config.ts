import type { ActivityFeedRouteConfig } from '@/lib/indieweb/types';
import { absoluteRoute, site } from '@/lib/site';

import type { ActivityFeedFormat } from './activity-feed-route';

const FEED_PATHS: Record<ActivityFeedFormat, string> = {
  rss: 'feed.xml',
  atom: 'feed/atom',
  json: 'feed/json',
};

/** Config for the site-wide webmention activity feed. */
export function globalActivityFeedConfig(
  format: ActivityFeedFormat
): ActivityFeedRouteConfig {
  const host = new URL(site.origin).hostname;
  return {
    title: `${site.name} - IndieWeb Activity`,
    description: `Recent likes, reposts, bookmarks, replies, and mentions for ${host}.`,
    feedUrl: absoluteRoute`/activity/${FEED_PATHS[format]}`,
  };
}

/** Config for one writing's webmention activity feed. */
export function writingActivityFeedConfig(
  slug: string,
  format: ActivityFeedFormat
): ActivityFeedRouteConfig {
  return {
    title: `IndieWeb Activity for ${slug}`,
    description: `Likes, reposts, bookmarks, replies, and mentions for ${slug}.`,
    feedUrl: absoluteRoute`/writings/${slug}/activity/${FEED_PATHS[format]}`,
  };
}
