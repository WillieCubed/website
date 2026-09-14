import {
  generateActivityAtomFeed,
  generateActivityJsonFeed,
  generateActivityRssFeed,
} from '@/lib/feeds';
import type {
  ActivityFeedItem,
  ActivityFeedRouteConfig,
} from '@/lib/indieweb/types';

export type ActivityFeedFormat = 'rss' | 'atom' | 'json';

export interface ActivityFeedResponseOptions {
  items: ActivityFeedItem[];
  config: ActivityFeedRouteConfig;
  format: ActivityFeedFormat;
}

const CONTENT_TYPES: Record<ActivityFeedFormat, string> = {
  rss: 'application/rss+xml; charset=utf-8',
  atom: 'application/atom+xml; charset=utf-8',
  json: 'application/feed+json; charset=utf-8',
};

export function createActivityFeedResponse({
  items,
  config,
  format,
}: ActivityFeedResponseOptions): Response {
  const body = serializeActivityFeed({ items, config, format });

  return new Response(body, {
    headers: {
      'Content-Type': CONTENT_TYPES[format],
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
    },
  });
}

function serializeActivityFeed({
  items,
  config,
  format,
}: ActivityFeedResponseOptions): string {
  if (format === 'rss') {
    return generateActivityRssFeed(items, config);
  }

  if (format === 'atom') {
    return generateActivityAtomFeed(items, {
      title: config.title,
      subtitle: config.description,
      feedUrl: config.feedUrl,
    });
  }

  return generateActivityJsonFeed(items, config);
}
