import {
  emptyResponses,
  loadBlueskyResponses,
  mergeResponses,
} from '@/lib/atproto/responses';
import {
  buildActivityFeedItems,
  extractWritingSlugFromTarget,
} from '@/lib/indieweb/activity-feed';
import type { ActivityFeedItem, ResponseActivity } from '@/lib/indieweb/types';
import {
  getAllWebmentionActivities,
  getWebmentionActivitiesForPost,
} from '@/lib/indieweb/webmention-storage';
import { getAllWritings, getPublishedWriting } from '@/lib/writings';

const titleCache = new Map<string, string>();

export async function getActivityFeedItemsForPost(
  slug: string
): Promise<ActivityFeedItem[]> {
  const published = await getPublishedWriting(slug).catch(() => null);
  if (!published) return [];
  const verified = await getWebmentionActivitiesForPost(slug).catch(() => []);
  const native = await loadBlueskyResponses(published.writing);
  const known = emptyResponses();
  for (const item of verified) {
    const key =
      item.type === 'reply'
        ? 'replies'
        : item.type === 'like'
          ? 'likes'
          : item.type === 'repost'
            ? 'reposts'
            : item.type === 'bookmark'
              ? 'bookmarks'
              : item.type === 'rsvp'
                ? 'rsvps'
                : 'mentions';
    known[key].push(item);
  }
  const merged = mergeResponses(known, native.groups);
  const activities: ResponseActivity[] = Object.values(merged)
    .flat()
    .filter(
      (item) =>
        item.origin !== 'atproto' || item.type !== 'repost' || item.observedAt
    )
    .map((item) => ({
      ...item,
      activityDate: item.publishedAt ?? item.observedAt ?? item.receivedAt,
      targetSlug: slug,
    }));
  return buildActivityFeedItems(activities, {
    titleForTarget: () => published.writing.title,
  });
}

export async function getGlobalActivityFeedItems(
  limit = 100
): Promise<ActivityFeedItem[]> {
  const verified = await getAllWebmentionActivities({ limit }).catch(() => []);
  const published = await getAllWritings(false);
  const items = await activitiesToFeedItems(
    verified.filter(
      (activity) => !extractWritingSlugFromTarget(activity.targetUrl)
    )
  );
  // Keep AppView work bounded across writings; the importer caches each response set.
  for (const writing of published)
    items.push(...(await getActivityFeedItemsForPost(writing.slug)));
  return items
    .sort((a, b) => b.published.getTime() - a.published.getTime())
    .slice(0, limit);
}

async function activitiesToFeedItems(
  activities: ResponseActivity[]
): Promise<ActivityFeedItem[]> {
  const titleEntries = await Promise.all(
    [...new Set(activities.map((activity) => activity.targetUrl))].map(
      async (targetUrl) => [targetUrl, await titleForTarget(targetUrl)] as const
    )
  );
  const titles = new Map(titleEntries);

  return buildActivityFeedItems(activities, {
    titleForTarget: (targetUrl) =>
      titles.get(targetUrl) || fallbackTitle(targetUrl),
  });
}

async function titleForTarget(targetUrl: string): Promise<string> {
  const cached = titleCache.get(targetUrl);
  if (cached) return cached;

  const slug = extractWritingSlugFromTarget(targetUrl);
  if (!slug) return fallbackTitle(targetUrl);

  try {
    const { writing } = await getPublishedWriting(slug);
    titleCache.set(targetUrl, writing.title);
    return writing.title;
  } catch {
    return fallbackTitle(targetUrl);
  }
}

function fallbackTitle(targetUrl: string): string {
  const slug = extractWritingSlugFromTarget(targetUrl);
  if (slug) return slug;

  try {
    return new URL(targetUrl).pathname || targetUrl;
  } catch {
    return targetUrl;
  }
}
