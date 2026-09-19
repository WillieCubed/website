import Icon, { type IconName } from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import { formatDate } from '@/lib/site';
import { WritingData } from '@/lib/writings';

interface WritingItemProps {
  writing: WritingData;
  /** Series name to display (resolved from slug) */
  seriesName?: string;
  /** Where the series name links; falls back to the writings index. */
  seriesHref?: string;
  /** Whether to show series info (default: true) */
  showSeriesInfo?: boolean;
}

/**
 * One entry in the index. The title, or the text when there is no title,
 * comes first; everything else is one quiet line under it.
 */
export default function WritingItem({
  writing,
  seriesName,
  seriesHref,
  showSeriesInfo = true,
}: WritingItemProps) {
  const publishedIso = new Date(writing.published).toISOString();
  const target = targetOf(writing);

  return (
    <article className="h-entry group relative -mx-3 rounded-2xl border border-line bg-card px-3 py-4 medium:-mx-5 medium:px-5 transition-colors hover:border-accent">
      {/* Main link covers the entire card */}
      <SiteLink
        href={`/writings/${writing.slug}`}
        preview={false}
        className="u-url absolute inset-0 z-10 rounded-2xl"
        aria-label={writing.title}
      />

      <div className="pointer-events-none relative space-y-2">
        {writing.hasExplicitTitle ? (
          <>
            <h2 className="p-name text-title-large font-semibold text-ink transition-colors group-hover:text-accent">
              {writing.title}
            </h2>
            <p className="p-summary text-body-medium text-muted">
              {writing.description}
            </p>
          </>
        ) : (
          <p className="p-name text-body-large text-ink">{writing.title}</p>
        )}

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-medium text-muted">
          {target && (
            <>
              <span className="flex items-center gap-1">
                <Icon name={target.icon} size={13} title={target.word} />
                {hostOf(target.url)}
              </span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <time className="dt-published" dateTime={publishedIso}>
            {formatDate(writing.published, 'short')}
          </time>
          {writing.hasExplicitTitle && (
            <>
              <span aria-hidden="true">·</span>
              <span>{writing.readingTime} min read</span>
            </>
          )}
          {writing.draft && (
            <span className="rounded-full bg-mint/40 px-2 py-0.5 text-ink">
              Draft
            </span>
          )}
        </p>
        {showSeriesInfo && writing.series && (
          <p className="text-label-medium text-muted">
            Part {writing.series.part} of{' '}
            <SiteLink
              href={seriesHref ?? '/writings'}
              className="link-animated pointer-events-auto relative z-20 font-medium text-ink"
            >
              {seriesName || writing.series.slug}
            </SiteLink>
          </p>
        )}
      </div>
    </article>
  );
}

function targetOf(
  writing: WritingData
): { url: string; icon: IconName; word: string } | null {
  if (writing.likeOf) {
    return { url: writing.likeOf, icon: 'heart', word: 'Liked' };
  }
  if (writing.repostOf) {
    return { url: writing.repostOf, icon: 'repeat', word: 'Reposted' };
  }
  if (writing.bookmarkOf) {
    return { url: writing.bookmarkOf, icon: 'bookmark', word: 'Bookmarked' };
  }
  if (writing.rsvp) {
    return { url: writing.rsvp.eventUrl, icon: 'calendar', word: 'RSVP' };
  }
  if (writing.inReplyTo) {
    return { url: writing.inReplyTo, icon: 'reply', word: 'Replying to' };
  }
  return null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
