import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import SharedTitle from '@/components/site/SharedTitle';

import { formatDate } from '@/lib/site';
import { WritingData } from '@/lib/writings';
import { writingAttachments } from '@/lib/writings/media';
import { locationText } from '@/lib/writings/properties';

import {
  TARGET_ICON,
  TARGET_PROPERTY,
  TARGET_WORD,
  hostOf,
  replyTargetsOf,
} from './ReplyTarget';

interface WritingItemProps {
  writing: WritingData;
  /** Series name to display (resolved from slug) */
  seriesName?: string;
  /** Where the series name links; falls back to the writings index. */
  seriesHref?: string;
  /** Whether to show series info (default: true) */
  showSeriesInfo?: boolean;
  /**
   * The body as HTML, for an entry without a headline. The index shows only
   * its first sentence, so the whole text rides along hidden as e-content.
   */
  contentHtml?: string;
}

/**
 * One entry in the index. The title, or the text when there is no title,
 * comes first; everything else is one quiet line under it. The rest of the
 * h-entry that the permalink shows, such as the page a reply answers, the
 * photos, and a note's whole text, is hidden markup for parsers, so a reader
 * subscribed to the index gets the same entry without a second fetch.
 */
export default function WritingItem({
  writing,
  seriesName,
  seriesHref,
  showSeriesInfo = true,
  contentHtml,
}: WritingItemProps) {
  const publishedIso = new Date(writing.published).toISOString();
  const targets = replyTargetsOf(writing);
  const target = targets[0];

  return (
    <article
      className={`${writing.postType === 'event' ? 'h-entry h-event' : 'h-entry'} group relative -mx-3 rounded-2xl border border-line bg-card px-3 py-4 medium:-mx-5 medium:px-5 transition-colors hover:border-accent`}
    >
      {/* Main link covers the entire card */}
      <SiteLink
        href={`/writings/${writing.slug}`}
        preview={false}
        className="u-url absolute inset-0 z-10 rounded-2xl"
        aria-label={writing.title}
      />
      {targets.map((target) => (
        <a
          key={`${target.kind}:${target.url}`}
          href={target.url}
          className={`${TARGET_PROPERTY[target.kind]} h-cite hidden`}
        >
          {hostOf(target.url)}
        </a>
      ))}
      {writing.rsvp && (
        <data className="p-rsvp hidden" value={writing.rsvp.status}>
          {writing.rsvp.status}
        </data>
      )}
      {writing.photos?.map((photo) => (
        <data key={photo.url} className="u-photo hidden" value={photo.url} />
      ))}
      {writingAttachments(writing).map((media) => (
        <data
          key={media.url}
          className={`${media.kind === 'file' ? 'u-attachment' : `u-${media.kind}`} hidden`}
          value={media.url}
        />
      ))}
      {writing.event?.start && (
        <time className="dt-start hidden" dateTime={writing.event.start} />
      )}
      {writing.event?.end && (
        <time className="dt-end hidden" dateTime={writing.event.end} />
      )}
      {locationText(writing.event?.location ?? writing.location) && (
        <span className="p-location hidden">
          {locationText(writing.event?.location ?? writing.location)}
        </span>
      )}
      {contentHtml && (
        <div
          className="e-content hidden"
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}

      <div className="pointer-events-none relative space-y-2">
        {writing.hasExplicitTitle ? (
          <>
            <h2 className="p-name text-title-large font-semibold text-ink transition-colors group-hover:text-accent">
              <SharedTitle id={`writing-${writing.slug}`} size="small">
                <span className="inline-block">{writing.title}</span>
              </SharedTitle>
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
                <Icon
                  name={TARGET_ICON[target.kind]}
                  size={13}
                  title={TARGET_WORD[target.kind]}
                />
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
