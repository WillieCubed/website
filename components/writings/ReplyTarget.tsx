import Image from 'next/image';

import Icon, { type IconName } from '@/components/icons/Icon';

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

const ICON: Record<TargetKind, IconName> = {
  reply: 'reply',
  like: 'heart',
  repost: 'repeat',
  bookmark: 'bookmark',
  rsvp: 'calendar',
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
        className={`${MICROFORMAT[kind]} h-cite group -mx-5 flex flex-col gap-1 rounded-2xl border border-line bg-card px-5 py-4 text-ink no-underline transition-colors hover:border-accent`}
        rel={kind === 'reply' || kind === 'rsvp' ? 'in-reply-to' : 'nofollow'}
      >
        <span className="flex items-center gap-2 text-label-medium text-muted">
          <Icon
            name={ICON[kind]}
            size={14}
            title={kind === 'reply' ? 'Replying to' : undefined}
          />
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
