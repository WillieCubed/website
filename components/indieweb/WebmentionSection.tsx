import WebmentionActivityFeed from '@/components/indieweb/WebmentionActivityFeed';

import { flattenWebmentionActivities } from '@/lib/indieweb/activity-feed';
import type { WebmentionGroup } from '@/lib/indieweb/types';

interface WebmentionSectionProps {
  webmentions: WebmentionGroup;
}

export default function WebmentionSection({
  webmentions,
}: WebmentionSectionProps) {
  const { likes, reposts, replies, mentions, bookmarks } = webmentions;
  const activities = flattenWebmentionActivities(webmentions);
  const totalCount =
    likes.length +
    reposts.length +
    replies.length +
    mentions.length +
    bookmarks.length;

  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-title-medium font-medium text-gray-700 dark:text-gray-300">
        Responses{' '}
        <span className="text-gray-500 dark:text-gray-400">({totalCount})</span>
      </h2>

      <div className="space-y-6">
        <ActivitySummary webmentions={webmentions} />
        <WebmentionActivityFeed activities={activities} />
      </div>
    </div>
  );
}

interface ActivitySummaryProps {
  webmentions: WebmentionGroup;
}

interface ActivitySummaryItem {
  label: string;
  count: number;
}

function ActivitySummary({ webmentions }: ActivitySummaryProps) {
  const counts: ActivitySummaryItem[] = [
    { label: 'Replies', count: webmentions.replies.length },
    { label: 'Mentions', count: webmentions.mentions.length },
    { label: 'Likes', count: webmentions.likes.length },
    { label: 'Reposts', count: webmentions.reposts.length },
    { label: 'Bookmarks', count: webmentions.bookmarks.length },
  ].filter((item) => item.count > 0);

  return (
    <dl className="grid grid-cols-2 gap-3 tablet:grid-cols-5">
      {counts.map(({ label, count }) => (
        <div key={label} className="rounded border border-outline-variant p-3">
          <dt className="text-label-small text-on-surface-variant">{label}</dt>
          <dd className="text-title-medium font-medium">{count}</dd>
        </div>
      ))}
    </dl>
  );
}
