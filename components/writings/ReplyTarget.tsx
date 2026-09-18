import Image from 'next/image';

import type { ReplyContext } from '@/lib/indieweb/reply-context';
import { formatDate } from '@/lib/site';
import type { RSVPStatus } from '@/lib/writings/types';

export type TargetKind = 'reply' | 'like' | 'repost' | 'bookmark' | 'rsvp';

interface ReplyTargetProps {
  url: string;
  kind: TargetKind;
  context?: ReplyContext;
  rsvpStatus?: RSVPStatus;
}

const MICROFORMAT: Record<TargetKind, string> = {
  reply: 'u-in-reply-to',
  like: 'u-like-of',
  repost: 'u-repost-of',
  bookmark: 'u-bookmark-of',
  rsvp: 'u-in-reply-to',
};

const RSVP_WORD: Record<RSVPStatus, string> = {
  yes: 'Going',
  no: 'Not going',
  maybe: 'Maybe going',
  interested: 'Interested',
};

/**
 * The page a post answers, likes, reposts, bookmarks, or RSVPs to. It reads
 * as the top of a thread: the card, then a short line down to the author
 * row of the post itself. The icon says which kind of post this is; likes
 * and the rest also get the one word a feed would show.
 */
export default function ReplyTarget({
  url,
  kind,
  context,
  rsvpStatus,
}: ReplyTargetProps) {
  const host = hostOf(url);
  const siteName = context?.siteName || host;
  const word =
    kind === 'rsvp' && rsvpStatus
      ? RSVP_WORD[rsvpStatus]
      : kind === 'like'
        ? 'Liked'
        : kind === 'repost'
          ? 'Reposted'
          : kind === 'bookmark'
            ? 'Bookmarked'
            : null;

  return (
    <div className="reply-target">
      <a
        href={url}
        className={`${MICROFORMAT[kind]} h-cite group flex flex-col gap-1 rounded-2xl border border-line bg-card px-5 py-4 text-ink no-underline transition-colors hover:border-accent`}
        rel={kind === 'reply' || kind === 'rsvp' ? 'in-reply-to' : 'nofollow'}
      >
        <span className="flex items-center gap-2 text-label-medium text-muted">
          <Icon kind={kind} />
          {word && <span>{word}</span>}
          {word && <span aria-hidden="true">·</span>}
          <span>{siteName}</span>
          {context?.publishedAt && (
            <>
              <span aria-hidden="true">·</span>
              <time
                className="dt-published"
                dateTime={context.publishedAt.toISOString()}
              >
                {formatDate(context.publishedAt, 'short')}
              </time>
            </>
          )}
        </span>
        {context?.authorName && (
          <span className="p-author h-card flex items-center gap-2 text-label-large">
            {context.authorPhoto && (
              <Image
                src={context.authorPhoto}
                alt=""
                width={20}
                height={20}
                className="u-photo size-5 rounded-full object-cover"
                unoptimized
              />
            )}
            <span className="p-name font-medium">{context.authorName}</span>
          </span>
        )}
        <span className="p-name text-title-medium font-semibold group-hover:text-accent">
          {context?.title || host}
        </span>
        {context?.contentPreview && (
          <span className="p-summary line-clamp-3 text-body-medium text-muted">
            {context.contentPreview}
          </span>
        )}
        {kind === 'rsvp' && rsvpStatus && (
          <data className="p-rsvp hidden" value={rsvpStatus}>
            {rsvpStatus}
          </data>
        )}
      </a>
      <span aria-hidden="true" className="reply-target__thread" />
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function Icon({ kind }: { kind: TargetKind }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (kind) {
    case 'reply':
      return (
        <svg {...common}>
          <title>Replying to</title>
          <path d="M9 14 4 9l5-5" />
          <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
        </svg>
      );
    case 'like':
      return (
        <svg {...common}>
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      );
    case 'repost':
      return (
        <svg {...common}>
          <path d="m17 2 4 4-4 4" />
          <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
          <path d="m7 22-4-4 4-4" />
          <path d="M21 13v1a4 4 0 0 1-4 4H3" />
        </svg>
      );
    case 'bookmark':
      return (
        <svg {...common}>
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
      );
    case 'rsvp':
      return (
        <svg {...common}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
  }
}
