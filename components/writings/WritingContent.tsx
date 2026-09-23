import WritingDetailsView from '@/app/writings/[slug]/WritingDetailsView';

import TableOfContents from '@/components/TableOfContents';
import SiteLink from '@/components/link/SiteLink';
import References from '@/components/references/References';

import { SeriesWithWritings, TOCHeading, WritingData } from '@/lib/writings';
import { extractReferences } from '@/lib/writings/references';

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
  const references = await extractReferences(content);
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

      <div className="mx-auto max-w-breakpoint-md space-y-10 px-lg desktop:px-0">
        {/* h-entry: e-content */}
        <div className="e-content">
          <WritingDetailsView source={content} />
        </div>

        {/* Person tags: an <a> h-card's name and url are implied from its
            text and href, so the chip itself is the whole card. */}
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
                  href={`/writings?tag=${encodeURIComponent(tag)}`}
                  className="p-category inline-block rounded-full border border-line bg-ground px-3 py-1 text-label-medium text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  {tag}
                </SiteLink>
              </li>
            ))}
          </ul>
        )}

        <References items={references} />

        {writing.series && seriesData && (
          <SeriesNav
            series={seriesData}
            writings={seriesData.writings}
            currentPart={writing.series.part}
          />
        )}
      </div>
    </>
  );
}
