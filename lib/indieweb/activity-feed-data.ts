import {
  buildActivityFeedItems,
  extractWritingSlugFromTarget,
} from '@/lib/indieweb/activity-feed';
import type {
  ActivityFeedItem,
  WebmentionActivity,
} from '@/lib/indieweb/types';
import {
  getAllWebmentionActivities,
  getWebmentionActivitiesForPost,
} from '@/lib/indieweb/webmention-storage';
import { getWriting } from '@/lib/writings';

const titleCache = new Map<string, string>();

export async function getActivityFeedItemsForPost(
  slug: string
): Promise<ActivityFeedItem[]> {
  try {
    const activities = await getWebmentionActivitiesForPost(slug);
    return activitiesToFeedItems(activities);
  } catch {
    return [];
  }
}

export async function getGlobalActivityFeedItems(
  limit = 100
): Promise<ActivityFeedItem[]> {
  try {
    const activities = await getAllWebmentionActivities({ limit });
    return activitiesToFeedItems(activities);
  } catch {
    return [];
  }
}

async function activitiesToFeedItems(
  activities: WebmentionActivity[]
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
    const { writing } = await getWriting(slug);
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
