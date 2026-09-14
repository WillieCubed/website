import type {
  ActivityFeedItem,
  BuildActivityFeedOptions,
  Webmention,
  WebmentionActivity,
  WebmentionGroup,
  WebmentionType,
} from '@/lib/indieweb/types';

const ACTIVITY_VERBS: Record<WebmentionType, string> = {
  like: 'liked',
  repost: 'reposted',
  reply: 'replied to',
  mention: 'mentioned',
  bookmark: 'bookmarked',
};

const ACTIVITY_LABELS: Record<WebmentionType, string> = {
  like: 'Like',
  repost: 'Repost',
  reply: 'Reply',
  mention: 'Mention',
  bookmark: 'Bookmark',
};

export function getActivityDate(webmention: Webmention): Date {
  return webmention.publishedAt ?? webmention.receivedAt;
}

export function flattenWebmentionActivities(
  group: WebmentionGroup
): WebmentionActivity[] {
  return [
    ...group.likes,
    ...group.reposts,
    ...group.replies,
    ...group.mentions,
    ...group.bookmarks,
  ]
    .map(toActivity)
    .sort((a, b) => b.activityDate.getTime() - a.activityDate.getTime());
}

export function sortWebmentionActivities(
  activities: WebmentionActivity[]
): WebmentionActivity[] {
  return [...activities].sort(
    (a, b) => b.activityDate.getTime() - a.activityDate.getTime()
  );
}

export function activityAuthorName(activity: WebmentionActivity): string {
  return (
    activity.author.name?.trim() ||
    activity.author.url?.trim() ||
    hostnameForUrl(activity.sourceUrl)
  );
}

export function activityLabel(type: WebmentionType): string {
  return ACTIVITY_LABELS[type];
}

export function activityVerb(type: WebmentionType): string {
  return ACTIVITY_VERBS[type];
}

export function activitySummary(activity: WebmentionActivity): string {
  const author = activityAuthorName(activity);
  const fallback = `${author} ${activityVerb(activity.type)} this post.`;
  const content = activity.content?.trim();
  return content && content.length > 0 ? content : fallback;
}

export function buildActivityFeedItems(
  activities: WebmentionActivity[],
  options: BuildActivityFeedOptions
): ActivityFeedItem[] {
  return sortWebmentionActivities(activities).map((activity) => {
    const author = activityAuthorName(activity);
    const targetTitle = options.titleForTarget(activity.targetUrl, activity);

    return {
      id: `webmention:${activity.id}:${activity.sourceUrl}:${activity.targetUrl}`,
      title: `${author} ${activityVerb(activity.type)} "${targetTitle}"`,
      description: activitySummary(activity),
      url: activity.sourceUrl,
      published: activity.activityDate,
      updated: activity.verifiedAt,
      categories: ['indieweb', activity.type],
      indieweb: {
        type: activity.type,
        source: activity.sourceUrl,
        target: activity.targetUrl,
        authorName: activity.author.name,
      },
    };
  });
}

export function extractWritingSlugFromTarget(targetUrl: string): string | null {
  try {
    const url = new URL(targetUrl);
    const match = url.pathname.match(/^\/writings\/([^/]+)\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function toActivity(webmention: Webmention): WebmentionActivity {
  return {
    ...webmention,
    activityDate: getActivityDate(webmention),
    targetSlug: extractWritingSlugFromTarget(webmention.targetUrl) ?? undefined,
  };
}

function hostnameForUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'Someone';
  }
}
