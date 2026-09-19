import {
  activityAuthorName,
  activityLabel,
  activitySummary,
} from '@/lib/indieweb/activity-feed';
import type { WebmentionActivity, WebmentionType } from '@/lib/indieweb/types';

export interface WebmentionActivityFeedProps {
  activities: WebmentionActivity[];
}

const ACTIVITY_TONE: Record<WebmentionType, string> = {
  like: 'border-tertiary/30 bg-tertiary-container text-on-tertiary-container',
  repost: 'border-primary/30 bg-primary-container text-on-primary-container',
  reply:
    'border-secondary/30 bg-secondary-container text-on-secondary-container',
  mention: 'border-outline-variant bg-surface-container-high text-on-surface',
  bookmark: 'border-primary/30 bg-primary-container text-on-primary-container',
};

function formatActivityDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function WebmentionActivityFeed({
  activities,
}: WebmentionActivityFeedProps) {
  if (activities.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-title-small font-medium">Activity</h3>
      <ol className="space-y-4">
        {activities.map((activity) => (
          <li key={activity.id}>
            <article className="rounded-lg border border-outline-variant bg-surface p-4">
              <header className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded border px-2 py-0.5 text-label-small font-medium ${ACTIVITY_TONE[activity.type]}`}
                >
                  {activityLabel(activity.type)}
                </span>
                {activity.author.url ? (
                  <a
                    href={activity.author.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-label-large font-medium hover:text-primary"
                  >
                    {activityAuthorName(activity)}
                  </a>
                ) : (
                  <span className="text-label-large font-medium">
                    {activityAuthorName(activity)}
                  </span>
                )}
                <time
                  className="text-label-small text-on-surface-variant"
                  dateTime={activity.activityDate.toISOString()}
                >
                  {formatActivityDate(activity.activityDate)}
                </time>
              </header>

              <p className="text-body-medium text-on-surface-variant">
                {activitySummary(activity)}
              </p>

              <a
                href={activity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-label-small text-primary hover:underline"
              >
                View original
              </a>
            </article>
          </li>
        ))}
      </ol>
    </div>
  );
}
