import BookmarkIcon from '@mui/icons-material/Bookmark';
import EventIcon from '@mui/icons-material/Event';
import FavoriteIcon from '@mui/icons-material/Favorite';
import RepeatIcon from '@mui/icons-material/Repeat';
import Image from 'next/image';

import type { ReplyContext as ReplyContextData } from '@/lib/indieweb/reply-context';

interface InteractionContextProps {
  /** The URL being interacted with */
  targetUrl: string;
  /** Type of interaction */
  interactionType: 'like' | 'repost' | 'bookmark' | 'rsvp';
  /** RSVP status if applicable */
  rsvpStatus?: 'yes' | 'no' | 'maybe' | 'interested';
  /** Rich context data (fetched at build time) */
  context?: ReplyContextData;
}

const INTERACTION_CONFIG: Record<
  'like' | 'repost' | 'bookmark' | 'rsvp',
  {
    icon: typeof FavoriteIcon;
    label: string;
    microformatClass: string;
    bgColor: string;
    iconColor: string;
    borderColor: string;
  }
> = {
  like: {
    icon: FavoriteIcon,
    label: 'Liked',
    microformatClass: 'u-like-of',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    iconColor: 'text-red-500',
    borderColor: 'border-red-200 dark:border-red-900',
  },
  repost: {
    icon: RepeatIcon,
    label: 'Reposted',
    microformatClass: 'u-repost-of',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    iconColor: 'text-green-600',
    borderColor: 'border-green-200 dark:border-green-900',
  },
  bookmark: {
    icon: BookmarkIcon,
    label: 'Bookmarked',
    microformatClass: 'u-bookmark-of',
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-500',
    borderColor: 'border-blue-200 dark:border-blue-900',
  },
  rsvp: {
    icon: EventIcon,
    label: 'RSVP',
    microformatClass: 'u-in-reply-to',
    bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    iconColor: 'text-purple-600',
    borderColor: 'border-purple-200 dark:border-purple-900',
  },
};

const RSVP_STATUS_LABELS: Record<string, string> = {
  yes: 'Attending',
  no: 'Not attending',
  maybe: 'Maybe attending',
  interested: 'Interested in',
};

/**
 * Displays the context of an interaction post (like, repost, bookmark, or RSVP).
 * Shows the target URL with appropriate microformat markup and visual styling.
 * When rich context is available, displays author, title, and preview.
 */
export default function InteractionContext({
  targetUrl,
  interactionType,
  rsvpStatus,
  context,
}: InteractionContextProps) {
  const config = INTERACTION_CONFIG[interactionType];
  const Icon = config.icon;

  // Parse hostname for display
  let hostname = targetUrl;
  try {
    hostname = new URL(targetUrl).hostname;
  } catch {
    // Use full URL if parsing fails
  }

  const label =
    interactionType === 'rsvp' && rsvpStatus
      ? RSVP_STATUS_LABELS[rsvpStatus]
      : config.label;

  const hasRichContext =
    context && (context.authorName || context.title || context.contentPreview);

  const formattedDate = context?.publishedAt
    ? new Date(context.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  // Simple display when no rich context
  if (!hasRichContext) {
    return (
      <div
        className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}
      >
        <div className="flex items-center gap-3">
          <Icon className={`size-6 ${config.iconColor}`} />
          <p className="text-label-large text-on-surface-variant">
            {label}{' '}
            <a
              href={targetUrl}
              className={`${config.microformatClass} link-animated font-medium text-primary`}
              rel={interactionType === 'rsvp' ? 'in-reply-to' : undefined}
            >
              {context?.siteName || hostname}
            </a>
            {interactionType === 'rsvp' && rsvpStatus && (
              <data className="p-rsvp hidden" value={rsvpStatus}>
                {rsvpStatus}
              </data>
            )}
          </p>
        </div>
      </div>
    );
  }

  // Rich context display
  return (
    <div
      className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}
    >
      {/* Header with icon and label */}
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`size-5 ${config.iconColor}`} />
        <span className="text-label-medium text-on-surface-variant">
          {label}
        </span>
        {interactionType === 'rsvp' && rsvpStatus && (
          <data className="p-rsvp hidden" value={rsvpStatus}>
            {rsvpStatus}
          </data>
        )}
      </div>

      {/* Rich context card */}
      <a
        href={targetUrl}
        className={`${config.microformatClass} group block rounded-lg border border-outline-variant bg-surface p-3 transition-colors hover:border-primary`}
        rel={interactionType === 'rsvp' ? 'in-reply-to' : 'nofollow'}
      >
        {/* Author row */}
        {context.authorName && (
          <div className="mb-2 flex items-center gap-2">
            {context.authorPhoto ? (
              <Image
                src={context.authorPhoto}
                alt={context.authorName}
                width={28}
                height={28}
                className="u-photo size-7 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <div className={`size-7 rounded-full ${config.bgColor}`} />
            )}
            <div className="flex flex-col">
              <span className="p-author h-card p-name text-label-medium font-medium group-hover:text-primary">
                {context.authorName}
              </span>
            </div>
          </div>
        )}

        {/* Title */}
        {context.title && (
          <h4 className="p-name mb-1 text-title-small font-medium group-hover:text-primary">
            {context.title}
          </h4>
        )}

        {/* Content preview */}
        {context.contentPreview && (
          <p className="p-content line-clamp-2 text-body-small text-on-surface-variant">
            {context.contentPreview}
          </p>
        )}

        {/* Date and source footer */}
        <div className="mt-2 flex items-center gap-2 text-label-small text-on-surface-variant/70">
          {formattedDate && (
            <>
              <time
                className="dt-published"
                dateTime={context.publishedAt?.toISOString()}
              >
                {formattedDate}
              </time>
              <span>·</span>
            </>
          )}
          <span>{context.siteName || hostname}</span>
        </div>
      </a>
    </div>
  );
}
