import FeedAuthor from '@/components/indieweb/FeedAuthor';
import SiteLink from '@/components/link/SiteLink';

import type { ReplyContext } from '@/lib/indieweb/reply-context';
import { formatDate } from '@/lib/site';
import { SeriesWithWritings, WritingData } from '@/lib/writings';

import ReplyTarget, { replyTargetOf } from './ReplyTarget';
import './writing.css';

interface WritingHeaderProps {
  writing: WritingData;
  seriesData: SeriesWithWritings | null;
  canonicalUrl: string;
  /** Pre-fetched reply contexts for interaction/reply URLs */
  replyContexts?: Map<string, ReplyContext>;
}

/**
 * An article opens with its title, a note opens with its date and goes
 * straight into the text. A post that answers another page carries that
 * page above it as the top of the thread. A photo post shows its photos
 * under the date, each a u-photo, before the caption. The hidden h-card gives
 * parsers an explicit author without adding a repeated visible byline.
 */
export default function WritingHeader({
  writing,
  seriesData,
  canonicalUrl,
  replyContexts,
}: WritingHeaderProps) {
  const publishedIso = new Date(writing.published).toISOString();
  const updatedIso = new Date(writing.lastUpdated).toISOString();
  const target = replyTargetOf(writing);

  return (
    <header className="mx-auto max-w-breakpoint-md px-lg pb-10 pt-10 desktop:px-0">
      {/* Permalink for parsers. u-uid marks it as the canonical identity. */}
      <a href={canonicalUrl} className="u-url u-uid hidden" />
      <FeedAuthor />
      {updatedIso !== publishedIso && (
        <time className="dt-updated hidden" dateTime={updatedIso} />
      )}

      {target && (
        <ReplyTarget
          url={target.url}
          kind={target.kind}
          context={replyContexts?.get(target.url)}
          rsvpStatus={writing.rsvp?.status}
        />
      )}

      {writing.hasExplicitTitle ? (
        <div>
          <div className="space-y-2">
            <h1 className="p-name text-headline-medium desktop:text-headline-large">
              {writing.title}
            </h1>
            <p className="p-summary text-body-large text-muted">
              {writing.description}
            </p>
          </div>
          <div className="mt-5">
            <Byline writing={writing} publishedIso={publishedIso} readingTime />
          </div>
          {writing.series && seriesData && (
            <p className="mt-2 text-label-large text-muted">
              Part {writing.series.part} of {seriesData.totalParts} ·{' '}
              <SiteLink
                href={seriesData.href}
                className="link-animated font-medium text-ink"
              >
                {seriesData.name}
              </SiteLink>
            </p>
          )}
        </div>
      ) : (
        <>
          <h1 className="p-name sr-only">{writing.title}</h1>
          <Byline writing={writing} publishedIso={publishedIso} />
        </>
      )}

      {writing.photos && (
        <div className="mt-lg space-y-md">
          {writing.photos.map((photo) => (
            // A plain img: uploads live on the media store's host, which
            // the image optimizer does not allow, and their size is unknown.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.url}
              src={photo.url}
              alt={photo.alt ?? ''}
              decoding="async"
              className="u-photo w-full rounded-2xl bg-card"
            />
          ))}
        </div>
      )}
    </header>
  );
}

function Byline({
  writing,
  publishedIso,
  readingTime = false,
}: {
  writing: WritingData;
  publishedIso: string;
  readingTime?: boolean;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-large text-muted">
      <time className="dt-published" dateTime={publishedIso}>
        {formatDate(writing.published)}
      </time>
      {readingTime && (
        <>
          <span aria-hidden="true">·</span>
          <span>{writing.readingTime} min read</span>
        </>
      )}
      {writing.syndication?.map((link) => (
        <span key={link.url} className="flex items-center gap-2">
          <span aria-hidden="true">·</span>
          <a
            href={link.url}
            className="u-syndication link-animated"
            rel="syndication"
          >
            {link.name}
          </a>
        </span>
      ))}
    </p>
  );
}
