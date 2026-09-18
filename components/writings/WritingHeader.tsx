import Link from 'next/link';

import ReplyContextDisplay from '@/components/indieweb/ReplyContext';

import type { ReplyContext } from '@/lib/indieweb/reply-context';
import { SeriesWithWritings, WritingData } from '@/lib/writings';

import InteractionContext from './InteractionContext';

interface WritingHeaderProps {
  writing: WritingData;
  seriesData: SeriesWithWritings | null;
  canonicalUrl: string;
  /** Pre-fetched reply contexts for interaction/reply URLs */
  replyContexts?: Map<string, ReplyContext>;
}

export default function WritingHeader({
  writing,
  seriesData,
  canonicalUrl,
  replyContexts,
}: WritingHeaderProps) {
  const publishedIso = new Date(writing.published).toISOString();
  const updatedIso = new Date(writing.lastUpdated).toISOString();

  const formattedPublishDate = new Date(writing.published).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }
  );

  return (
    <header className="mx-auto max-w-breakpoint-md px-lg pb-lg pt-16 desktop:px-0">
      {/* Hidden microformats data */}
      <a href={canonicalUrl} className="u-url hidden" />

      <div className="space-y-md">
        {/* Interaction context (for like, repost, bookmark, rsvp posts) */}
        {writing.likeOf && (
          <InteractionContext
            targetUrl={writing.likeOf}
            interactionType="like"
            context={replyContexts?.get(writing.likeOf)}
          />
        )}
        {writing.repostOf && (
          <InteractionContext
            targetUrl={writing.repostOf}
            interactionType="repost"
            context={replyContexts?.get(writing.repostOf)}
          />
        )}
        {writing.bookmarkOf && (
          <InteractionContext
            targetUrl={writing.bookmarkOf}
            interactionType="bookmark"
            context={replyContexts?.get(writing.bookmarkOf)}
          />
        )}
        {writing.rsvp && (
          <InteractionContext
            targetUrl={writing.rsvp.eventUrl}
            interactionType="rsvp"
            rsvpStatus={writing.rsvp.status}
            context={replyContexts?.get(writing.rsvp.eventUrl)}
          />
        )}

        {/* Reply context (for reply posts - separate from interaction types) */}
        {writing.inReplyTo &&
          !writing.rsvp &&
          (replyContexts?.get(writing.inReplyTo) ? (
            <ReplyContextDisplay
              context={replyContexts.get(writing.inReplyTo)!}
              label="In reply to"
              microformatClass="u-in-reply-to"
            />
          ) : (
            <div className="rounded-lg border border-secondary/20 bg-secondary/5 p-4">
              <p className="text-label-large text-on-surface-variant">
                In reply to{' '}
                <a
                  href={writing.inReplyTo}
                  className="u-in-reply-to link-animated font-medium text-primary"
                  rel="in-reply-to"
                >
                  {new URL(writing.inReplyTo).hostname}
                </a>
              </p>
            </div>
          ))}

        {/* Reading time */}
        <div
          className="flex animate-fade-in items-center gap-3"
          style={{ animationDelay: '0ms' }}
        >
          <span className="text-label-medium text-gray-500 dark:text-gray-400">
            {writing.readingTime} min read
          </span>
        </div>

        {/* h-entry: p-name */}
        <h1
          className="p-name animate-fade-in-up text-headline-medium desktop:text-headline-large"
          style={{ animationDelay: '50ms', animationFillMode: 'backwards' }}
        >
          {writing.title}
        </h1>

        {/* h-entry: p-summary */}
        <p
          className="p-summary animate-fade-in-up text-title-large text-primary"
          style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}
        >
          {writing.description}
        </p>

        {/* Meta info: date, author, tags */}
        <div className="flex flex-wrap items-center gap-4 text-label-large text-gray-600 dark:text-gray-400">
          {/* h-entry: dt-published */}
          <time className="dt-published" dateTime={publishedIso}>
            {formattedPublishDate}
          </time>

          {/* h-entry: dt-updated (hidden if same as published) */}
          {updatedIso !== publishedIso && (
            <time className="dt-updated hidden" dateTime={updatedIso} />
          )}

          {/* h-entry: p-author with h-card */}
          <Link href="/" rel="author" className="p-author h-card u-url hidden">
            <span className="p-name">Willie Chalmers III</span>
            <span className="u-url">https://williecubed.me</span>
          </Link>

          {/* Tags */}
          {writing.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {writing.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/writings?tag=${encodeURIComponent(tag)}`}
                  className="p-category rounded bg-gray-100 px-2 py-0.5 text-label-small hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Series indicator */}
        {writing.series && seriesData && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-label-large">
              Part {writing.series.part} of {seriesData.totalParts} in the{' '}
              <Link
                href={seriesData.href}
                className="link-animated font-semibold"
              >
                {seriesData.name}
              </Link>{' '}
              series
            </p>
          </div>
        )}

        {/* Syndication links (POSSE) */}
        {writing.syndication && writing.syndication.length > 0 && (
          <div className="text-label-medium text-gray-500 dark:text-gray-400">
            Also on:{' '}
            {writing.syndication.map((link, index) => (
              <span key={link.url}>
                <a
                  href={link.url}
                  className="u-syndication link-animated text-primary"
                  rel="syndication"
                >
                  {link.name}
                </a>
                {index < writing.syndication!.length - 1 && ', '}
              </span>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
