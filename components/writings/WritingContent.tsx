import SiteLink from '@/components/link/SiteLink';
import NativeVideo from '@/components/media/NativeVideo';
import References from '@/components/references/References';
import TableOfContents from '@/components/writings/TableOfContents';
import TagChips, { CATEGORY_CHIP } from '@/components/writings/TagChips';
import WritingDetailsView from '@/components/writings/WritingDetailsView';

import type { ResponseMedia } from '@/lib/indieweb/webmention/types';
import { absoluteUrl } from '@/lib/site/urls';
import {
  SeriesWithWritings,
  TOCHeading,
  WritingData,
} from '@/lib/writings/index';
import {
  prepareWritingHtmlMedia,
  writingAttachments,
  writingPhotoMedia,
} from '@/lib/writings/media';
import {
  type WritingPropertyLink,
  locationText,
  propertyLinks,
  propertyUrl,
} from '@/lib/writings/properties';
import { extractReferences } from '@/lib/writings/references';
import type { WritingEvent } from '@/lib/writings/types';

import SeriesNav from './SeriesNav';

interface WritingContentProps {
  content: string;
  headings: TOCHeading[];
  writing: WritingData;
  seriesData: SeriesWithWritings | null;
}

interface WritingBodyProps {
  content: string;
  writing: WritingData;
  html?: string;
}

function WritingBody({ content, writing, html }: WritingBodyProps) {
  return (
    <>
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
          className="prose prose-neutral max-w-none text-ink dark:prose-invert [&_audio]:w-full [&_video]:max-h-96 [&_video]:w-full [&_a.u-attachment]:inline-flex [&_a.u-attachment]:max-w-full [&_a.u-attachment]:rounded-full [&_a.u-attachment]:bg-tray [&_a.u-attachment]:px-4 [&_a.u-attachment]:py-2 [&_a.u-attachment]:font-medium [&_a.u-attachment]:text-ink [&_a.u-attachment]:no-underline [&_a.u-attachment:hover]:bg-surface-container-highest"
          dangerouslySetInnerHTML={{
            __html: html!,
          }}
        />
      ) : (
        <WritingDetailsView
          source={content}
          largeText={writing.postType === 'note'}
        />
      )}
    </>
  );
}

interface WritingAttachmentsProps {
  attachments: ResponseMedia[];
}

function WritingAttachments({ attachments }: WritingAttachmentsProps) {
  return (
    <>
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
    </>
  );
}

interface WritingEventDetailsProps {
  event?: WritingEvent;
}

function WritingEventDetails({ event }: WritingEventDetailsProps) {
  return (
    <>
      {event && (
        <dl className="mt-6 space-y-2 text-body-medium">
          {event.start && (
            <div>
              <dt className="text-muted">Starts</dt>
              <dd>
                <time className="dt-start" dateTime={event.start}>
                  {new Date(event.start).toLocaleString('en-US', {
                    timeZone: 'UTC',
                    timeZoneName: 'short',
                  })}
                </time>
              </dd>
            </div>
          )}
          {event.end && (
            <div>
              <dt className="text-muted">Ends</dt>
              <dd>
                <time className="dt-end" dateTime={event.end}>
                  {new Date(event.end).toLocaleString('en-US', {
                    timeZone: 'UTC',
                    timeZoneName: 'short',
                  })}
                </time>
              </dd>
            </div>
          )}
        </dl>
      )}
    </>
  );
}

interface WritingLocationProps {
  location: unknown;
}

function WritingLocation({ location }: WritingLocationProps) {
  const locationName = locationText(location);
  const locationUrl = propertyUrl(location);
  return (
    <>
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
    </>
  );
}

interface WritingCitationsProps {
  citations: WritingPropertyLink[];
}

function WritingCitations({ citations }: WritingCitationsProps) {
  return (
    <>
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
    </>
  );
}

interface WritingCategoriesProps {
  writing: WritingData;
}

function WritingCategories({ writing }: WritingCategoriesProps) {
  // Keyed by slug: a soft navigation keeps the previous writing in the DOM.
  const peopleLabelId = `people-${writing.slug}`;
  return (
    <>
      {(writing.people.length > 0 || writing.tags.length > 0) && (
        <div className="mt-4 space-y-3">
          {writing.people.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span id={peopleLabelId} className="text-label-medium text-muted">
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
                      className={`u-category h-card ${CATEGORY_CHIP}`}
                    >
                      {person.name}
                    </SiteLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <TagChips tags={writing.tags} chipClassName="p-category" />
        </div>
      )}
    </>
  );
}

function prepareContentMedia(content: string, writing: WritingData) {
  const suppliedAttachments = writingAttachments(writing);
  const htmlMedia =
    writing.contentFormat === 'html'
      ? prepareWritingHtmlMedia(
          content,
          [...writingPhotoMedia(writing), ...suppliedAttachments],
          absoluteUrl(`/writings/${writing.slug}`)
        )
      : undefined;
  const attachments = htmlMedia
    ? htmlMedia.attachments.filter((media) => media.kind !== 'image')
    : suppliedAttachments;
  return { htmlMedia, attachments };
}

export default async function WritingContent({
  content,
  headings,
  writing,
  seriesData,
}: WritingContentProps) {
  const location = writing.event?.location ?? writing.location;
  const showToc = headings.length >= 3;
  const { htmlMedia, attachments } = prepareContentMedia(content, writing);
  const citations = propertyLinks(writing, 'citation');
  const references = writing.contentFormat
    ? []
    : await extractReferences(content);

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
          <WritingBody
            content={content}
            writing={writing}
            html={htmlMedia?.html}
          />
          <WritingAttachments attachments={attachments} />
          <WritingEventDetails event={writing.event} />
          <WritingLocation location={location} />
          <WritingCitations citations={citations} />
        </div>

        {/* Person tags: an <a> h-card's name and url are implied from its
            text and href, so the chip itself is the whole card. */}
        <WritingCategories writing={writing} />

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
