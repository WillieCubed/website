import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildActivityFeedItems,
  flattenWebmentionActivities,
} from '@/lib/indieweb/activity-feed';
import { WEBSUB_HUB } from '@/lib/indieweb/constants';
import { activityFeedChannel } from '@/lib/indieweb/feeds/index';
import { activityFeedResponse } from '@/lib/indieweb/feeds/response';
import type { WebmentionGroup } from '@/lib/indieweb/webmention/types';
import { site } from '@/lib/site/identity';

const channel = activityFeedChannel('json');

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
  rsvps: [],
};

test('activityFeedResponse serializes IndieWeb metadata in JSON Feed items', async () => {
  const items = buildActivityFeedItems(flattenWebmentionActivities(group), {
    titleForTarget: () => 'Original Post',
  });

  const response = activityFeedResponse('json', items, channel);

  const json = await response.json();

  assert.equal(
    response.headers.get('Content-Type'),
    'application/feed+json; charset=utf-8'
  );
  assert.equal(
    response.headers.get('Link'),
    `<${WEBSUB_HUB}>; rel="hub", <${site.origin}/activity/feed/json>; rel="self"`
  );
  assert.equal(json.items[0]._indieweb.type, 'like');
  assert.equal(json.items[0]._indieweb.source, 'https://example.com/like');
  assert.equal(
    json.items[0]._indieweb.target,
    `${site.origin}/writings/original-post`
  );
  assert.match(json.items[0].id, /^webmention:like-1:/);
});
