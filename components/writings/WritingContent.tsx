import WritingDetailsView from '@/app/writings/[slug]/WritingDetailsView';

import TableOfContents from '@/components/TableOfContents';
import SiteLink from '@/components/link/SiteLink';
import NativeVideo from '@/components/media/NativeVideo';
import References from '@/components/references/References';

import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import { absoluteUrl } from '@/lib/site';
import { SeriesWithWritings, TOCHeading, WritingData } from '@/lib/writings';
import { writingAttachments } from '@/lib/writings/media';
import {
  locationText,
  propertyLinks,
  propertyUrl,
} from '@/lib/writings/properties';
import { extractReferences } from '@/lib/writings/references';
import { tagPath } from '@/lib/writings/tags';

import SeriesNav from './SeriesNav';

interface WritingContentProps {
  content: string;
  headings: TOCHeading[];
  writing: WritingData;
  seriesData: SeriesWithWritings | null;
}

export default async function WritingContent({
  content,
  headings,
  writing,
  seriesData,
}: WritingContentProps) {
  const showToc = headings.length >= 3;
  const attachments = writingAttachments(writing);
  const location = writing.event?.location ?? writing.location;
  const locationName = locationText(location);
  const locationUrl = propertyUrl(location);
  const citations = propertyLinks(writing, 'citation');
  const references = writing.contentFormat
    ? []
    : await extractReferences(content);
  // Keyed by slug: a soft navigation keeps the previous writing in the DOM.
  const peopleLabelId = `people-${writing.slug}`;

  return (
    <>
      {/* Mobile TOC */}
      {showToc && (
        <div className="mx-auto max-w-breakpoint-md px-lg pb-6 desktop:hidden">
          <TableOfContents headings={headings} />
        </div>
      )}

      <div className="mx-auto max-w-breakpoint-md px-lg desktop:px-0">
        {/* h-entry: e-content */}
        <div className="e-content">
          {writing.contentFormat === 'text' ? (
            <div
              dir="auto"
              className="prose prose-neutral max-w-none whitespace-pre-wrap text-ink dark:prose-invert"
            >
              {content}
            </div>
          ) : writing.contentFormat === 'html' ? (
            <div
              dir="auto"
              className="prose prose-neutral max-w-none text-ink dark:prose-invert [&_audio]:w-full [&_video]:max-h-96 [&_video]:w-full"
              dangerouslySetInnerHTML={{
                __html: sanitizeCommentHtml(
                  content,
                  absoluteUrl(`/writings/${writing.slug}`)
                ),
              }}
            />
          ) : (
            <WritingDetailsView
              source={content}
              largeText={writing.postType === 'note'}
            />
          )}
          {attachments.length > 0 && (
            <div className="mt-6 space-y-4">
              {attachments.map((media) => (
                <figure key={media.url}>
                  {media.kind === 'audio' ? (
                    <audio
                      src={media.url}
                      className="u-audio w-full"
                      controls
                      preload="none"
                      aria-label={media.description || 'Audio'}
                    />
                  ) : media.kind === 'video' ? (
                    <NativeVideo
                      src={media.url}
                      className="u-video max-h-96 w-full rounded-2xl"
                      description={media.description || 'Video'}
                      sourceUrl={media.url}
                    />
                  ) : (
                    <SiteLink
                      href={media.url}
                      className="u-attachment inline-flex rounded-full bg-tray px-4 py-2 text-label-large text-ink"
                    >
                      {media.description || 'Download attachment'}
                    </SiteLink>
                  )}
                  {media.description && media.kind !== 'file' && (
                    <figcaption className="mt-2 text-body-small text-muted">
                      {media.description}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
          {writing.event && (
            <dl className="mt-6 space-y-2 text-body-medium">
              {writing.event.start && (
                <div>
                  <dt className="text-muted">Starts</dt>
                  <dd>
                    <time className="dt-start" dateTime={writing.event.start}>
                      {new Date(writing.event.start).toLocaleString('en-US', {
                        timeZone: 'UTC',
                        timeZoneName: 'short',
                      })}
                    </time>
                  </dd>
                </div>
              )}
              {writing.event.end && (
                <div>
                  <dt className="text-muted">Ends</dt>
                  <dd>
                    <time className="dt-end" dateTime={writing.event.end}>
                      {new Date(writing.event.end).toLocaleString('en-US', {
                        timeZone: 'UTC',
                        timeZoneName: 'short',
                      })}
                    </time>
                  </dd>
                </div>
              )}
            </dl>
          )}
          {locationName && (
            <p className="p-location mt-4 text-body-medium text-muted">
              {locationUrl ? (
                <SiteLink href={locationUrl} className="h-card u-url">
                  <span className="p-name">{locationName}</span>
                </SiteLink>
              ) : (
                locationName
              )}
            </p>
          )}
          {citations.length > 0 && (
            <ul className="mt-4 space-y-2 text-body-medium">
              {citations.map((citation) => (
                <li key={citation.url}>
                  <SiteLink
                    href={citation.url}
                    className="u-citation link-animated"
                  >
                    {citation.name}
                  </SiteLink>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Person tags: an <a> h-card's name and url are implied from its
            text and href, so the chip itself is the whole card. */}
        {(writing.people.length > 0 || writing.tags.length > 0) && (
          <div className="mt-4 space-y-3">
            {writing.people.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  id={peopleLabelId}
                  className="text-label-medium text-muted"
                >
                  With
                </span>
                <ul
                  className="flex flex-wrap gap-2"
                  aria-labelledby={peopleLabelId}
                >
                  {writing.people.map((person) => (
                    <li key={person.url}>
                      <SiteLink
                        href={person.url}
                        className="u-category h-card inline-block rounded-full border border-line bg-ground px-3 py-1 text-label-medium text-ink transition-colors hover:border-accent hover:text-accent"
                      >
                        {person.name}
                      </SiteLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {writing.tags.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Tags">
                {writing.tags.map((tag) => (
                  <li key={tag}>
                    <SiteLink
                      href={tagPath(tag)}
                      className="p-category inline-block rounded-full border border-line bg-ground px-3 py-1 text-label-medium text-ink transition-colors hover:border-accent hover:text-accent"
                    >
                      {tag}
                    </SiteLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {references.length > 0 && (
          <div className="mt-10">
            <References items={references} />
          </div>
        )}

        {writing.series && seriesData && (
          <div className="mt-10">
            <SeriesNav
              series={seriesData}
              writings={seriesData.writings}
              currentPart={writing.series.part}
            />
          </div>
        )}
      </div>
    </>
  );
}
