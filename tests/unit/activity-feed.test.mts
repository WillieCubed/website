import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildActivityFeedItems,
  flattenWebmentionActivities,
} from '@/lib/indieweb/activity-feed';
import type { WebmentionGroup } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

const baseDate = new Date('2026-05-18T12:00:00Z');

function mention(
  id: string,
  type: 'like' | 'repost' | 'reply' | 'mention' | 'bookmark',
  overrides: Partial<WebmentionGroup['likes'][number]> = {}
): WebmentionGroup['likes'][number] {
  return {
    id,
    sourceUrl: `https://example.com/${id}`,
    targetUrl: `${site.origin}/writings/original-post`,
    type,
    author: { name: `Author ${id}`, url: `https://example.com/${id}` },
    content: undefined,
    publishedAt: undefined,
    receivedAt: baseDate,
    verifiedAt: undefined,
    isVerified: true,
    isApproved: true,
    ...overrides,
  };
}

test('flattenWebmentionActivities returns every type sorted by activity date', () => {
  const group: WebmentionGroup = {
    likes: [
      mention('older-like', 'like', {
        publishedAt: new Date('2026-05-15T12:00:00Z'),
      }),
    ],
    reposts: [
      mention('newer-repost', 'repost', {
        publishedAt: new Date('2026-05-17T12:00:00Z'),
      }),
    ],
    replies: [
      mention('reply', 'reply', {
        publishedAt: new Date('2026-05-16T12:00:00Z'),
      }),
    ],
    mentions: [],
    bookmarks: [
      mention('bookmark-without-published', 'bookmark', {
        receivedAt: new Date('2026-05-18T12:00:00Z'),
      }),
    ],
  };

  const activities = flattenWebmentionActivities(group);

  assert.deepEqual(
    activities.map((activity) => activity.id),
    ['bookmark-without-published', 'newer-repost', 'reply', 'older-like']
  );
  assert.equal(
    activities[0].activityDate.toISOString(),
    '2026-05-18T12:00:00.000Z'
  );
});

test('buildActivityFeedItems gives likes and reposts first-class feed entries', () => {
  const activities = flattenWebmentionActivities({
    likes: [
      mention('like', 'like', {
        publishedAt: new Date('2026-05-15T12:00:00Z'),
      }),
    ],
    reposts: [
      mention('repost', 'repost', {
        content: 'I shared this with a note.',
        publishedAt: new Date('2026-05-16T12:00:00Z'),
      }),
    ],
    replies: [
      mention('reply', 'reply', {
        content: 'A thoughtful reply.',
        publishedAt: new Date('2026-05-17T12:00:00Z'),
      }),
    ],
    mentions: [],
    bookmarks: [],
  });

  const items = buildActivityFeedItems(activities, {
    titleForTarget: () => 'Original Post',
  });

  assert.deepEqual(
    items.map((item) => item.indieweb?.type),
    ['reply', 'repost', 'like']
  );
  assert.equal(items[0].title, 'Author reply replied to "Original Post"');
  assert.equal(items[1].title, 'Author repost reposted "Original Post"');
  assert.equal(items[2].description, 'Author like liked this post.');
  assert.equal(items[1].description, 'I shared this with a note.');
});
