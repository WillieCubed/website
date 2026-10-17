import type { ActivityFeedItem } from '@/lib/indieweb/webmention/types';
import { webSubLinkHeader } from '@/lib/indieweb/websub-discovery';

import {
  type FeedChannel,
  type FeedFormat,
  type FeedItem,
  serializeActivityFeed,
  serializeFeed,
} from './index';

const CONTENT_TYPES: Record<FeedFormat, string> = {
  rss: 'application/rss+xml; charset=utf-8',
  atom: 'application/atom+xml; charset=utf-8',
  json: 'application/feed+json; charset=utf-8',
};

function response(format: FeedFormat, body: string, channel: FeedChannel) {
  return new Response(body, {
    headers: {
      'Content-Type': CONTENT_TYPES[format],
      'Cache-Control':
        'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
      // JSON Feed has no element for its hub, so it is advertised here.
      ...(format === 'json' && channel.feedUrl
        ? { Link: webSubLinkHeader(channel.feedUrl) }
        : {}),
    },
  });
}

/** A feed route's response: the serialized items and their cache headers. */
export function feedResponse(
  format: FeedFormat,
  items: FeedItem[],
  channel: FeedChannel
): Response {
  return response(format, serializeFeed(format, items, channel), channel);
}

/** An activity feed route's response. */
export function activityFeedResponse(
  format: FeedFormat,
  items: ActivityFeedItem[],
  channel: FeedChannel
): Response {
  return response(
    format,
    serializeActivityFeed(format, items, channel),
    channel
  );
}
