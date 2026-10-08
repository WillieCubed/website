import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import type {
  ActivityFeedItem,
  BuildActivityFeedOptions,
  ResponseActivity,
  Webmention,
  WebmentionActivity,
  WebmentionGroup,
  WebmentionType,
} from '@/lib/indieweb/types';
import { plainTextHtml } from '@/lib/writings/content';
import { responseMediaHtml } from '@/lib/writings/media';

const ACTIVITY_VERBS: Record<WebmentionType, string> = {
  like: 'liked',
  repost: 'reposted',
  reply: 'replied to',
  mention: 'mentioned',
  bookmark: 'bookmarked',
  rsvp: 'RSVPed to',
};

const ACTIVITY_LABELS: Record<WebmentionType, string> = {
  like: 'Like',
  repost: 'Repost',
  reply: 'Reply',
  mention: 'Mention',
  bookmark: 'Bookmark',
  rsvp: 'RSVP',
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
    ...group.rsvps,
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

export function activityAuthorName(activity: ResponseActivity): string {
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

export function activitySummary(activity: ResponseActivity): string {
  const author = activityAuthorName(activity);
  const fallback = `${author} ${activityVerb(activity.type)} this post.`;
  const content = activity.content?.trim();
  return content && content.length > 0 ? content : fallback;
}

export function buildActivityFeedItems(
  activities: ResponseActivity[],
  options: BuildActivityFeedOptions
): ActivityFeedItem[] {
  return [...activities]
    .sort((a, b) => b.activityDate.getTime() - a.activityDate.getTime())
    .map((activity) => {
      const author = activityAuthorName(activity);
      const targetTitle = options.titleForTarget(activity.targetUrl, activity);

      return {
        id: `${activity.origin === 'atproto' ? 'atproto' : 'webmention'}:${activity.id}:${activity.sourceUrl}:${activity.targetUrl}`,
        title: `${author} ${activityVerb(activity.type)} "${targetTitle}"`,
        description: activitySummary(activity),
        author: activity.author,
        content:
          (activity.contentHtml
            ? sanitizeCommentHtml(activity.contentHtml, activity.sourceUrl)
            : activity.media?.length
              ? plainTextHtml(activity.content || '')
              : '') +
            (activity.media?.length
              ? responseMediaHtml(activity.media, activity.sourceUrl)
              : '') || undefined,
        attachments: activity.media
          ?.filter((media) => media.mimeType)
          .map((media) => ({
            url: media.url,
            mime_type: media.mimeType!,
            title: media.description,
          })),
        url: activity.sourceUrl,
        published: activity.activityDate,
        updated: activity.verifiedAt,
        categories: [
          activity.origin === 'atproto' ? 'atproto' : 'indieweb',
          activity.type,
        ],
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
