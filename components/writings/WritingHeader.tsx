import SiteLink from '@/components/link/SiteLink';

import type { ReplyContext } from '@/lib/indieweb/reply-context';
import { formatDate } from '@/lib/site';
import { SeriesWithWritings, WritingData } from '@/lib/writings';

import ReplyTarget, { type TargetKind } from './ReplyTarget';
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
 * page above it as the top of the thread. No byline names the author:
 * the top bar's way home is rel="author", and the homepage h-card is the
 * representative card, which is the authorship algorithm's own path.
 */
export default function WritingHeader({
  writing,
  seriesData,
  canonicalUrl,
  replyContexts,
}: WritingHeaderProps) {
  const publishedIso = new Date(writing.published).toISOString();
  const updatedIso = new Date(writing.lastUpdated).toISOString();
  const target = targetOf(writing);

  return (
    <header className="mx-auto max-w-breakpoint-md px-lg pb-md pt-8 desktop:px-0">
      {/* Permalink for parsers. u-uid marks it as the canonical identity. */}
      <a href={canonicalUrl} className="u-url u-uid hidden" />
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
        <div className="space-y-md">
          <h1 className="p-name text-headline-medium desktop:text-headline-large">
            {writing.title}
          </h1>
          <p className="p-summary text-title-large text-accent">
            {writing.description}
          </p>
          <Byline writing={writing} publishedIso={publishedIso} readingTime />
          {writing.series && seriesData && (
            <p className="text-label-large text-muted">
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
    </header>
  );
}

function targetOf(
  writing: WritingData
): { url: string; kind: TargetKind } | null {
  if (writing.likeOf) return { url: writing.likeOf, kind: 'like' };
  if (writing.repostOf) return { url: writing.repostOf, kind: 'repost' };
  if (writing.bookmarkOf) return { url: writing.bookmarkOf, kind: 'bookmark' };
  if (writing.rsvp) return { url: writing.rsvp.eventUrl, kind: 'rsvp' };
  if (writing.inReplyTo) return { url: writing.inReplyTo, kind: 'reply' };
  return null;
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
