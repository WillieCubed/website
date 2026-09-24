import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildActivityFeedItems,
  flattenWebmentionActivities,
} from '@/lib/indieweb/activity-feed';
import { WEBSUB_HUB } from '@/lib/indieweb/constants';
import type {
  ActivityFeedRouteConfig,
  WebmentionGroup,
} from '@/lib/indieweb/types';
import { site } from '@/lib/site';

const config: ActivityFeedRouteConfig = {
  title: 'Activity',
  description: 'Recent IndieWeb activity',
  feedUrl: `${site.origin}/activity/feed/json`,
};

const group: WebmentionGroup = {
  likes: [
    {
      id: 'like-1',
      sourceUrl: 'https://example.com/like',
      targetUrl: `${site.origin}/writings/original-post`,
      type: 'like',
      author: { name: 'Ada' },
      receivedAt: new Date('2026-05-18T12:00:00Z'),
      isVerified: true,
      isApproved: true,
    },
  ],
  reposts: [],
  replies: [],
  mentions: [],
  bookmarks: [],
};

test('createActivityFeedResponse serializes IndieWeb metadata in JSON Feed items', async () => {
  const { createActivityFeedResponse } =
    await import('@/lib/indieweb/activity-feed-route');

  const items = buildActivityFeedItems(flattenWebmentionActivities(group), {
    titleForTarget: () => 'Original Post',
  });

  const response = createActivityFeedResponse({
    items,
    config,
    format: 'json',
  });

  const json = await response.json();

  assert.equal(
    response.headers.get('Content-Type'),
    'application/feed+json; charset=utf-8'
  );
  assert.equal(
    response.headers.get('Link'),
    `<${WEBSUB_HUB}>; rel="hub", <${config.feedUrl}>; rel="self"`
  );
  assert.equal(json.items[0]._indieweb.type, 'like');
  assert.equal(json.items[0]._indieweb.source, 'https://example.com/like');
  assert.equal(
    json.items[0]._indieweb.target,
    `${site.origin}/writings/original-post`
  );
  assert.match(json.items[0].id, /^webmention:like-1:/);
});
