import WritingDetailsView from '@/app/writings/[slug]/WritingDetailsView';

import TableOfContents from '@/components/TableOfContents';

import { SeriesWithWritings, TOCHeading, WritingData } from '@/lib/writings';

import SeriesNav from './SeriesNav';

interface WritingContentProps {
  content: string;
  headings: TOCHeading[];
  writing: WritingData;
  seriesData: SeriesWithWritings | null;
}

export default function WritingContent({
  content,
  headings,
  writing,
  seriesData,
}: WritingContentProps) {
  const showToc = headings.length >= 3;

  return (
    <>
      {/* Mobile TOC */}
      {showToc && (
        <div className="mx-auto max-w-breakpoint-md px-lg pb-6 desktop:hidden">
          <TableOfContents headings={headings} />
        </div>
      )}

      {/* Main content */}
      <div className="mx-auto max-w-breakpoint-md px-lg desktop:px-0">
        {/* h-entry: e-content */}
        <div className="e-content pb-12 tablet:pb-16">
          <WritingDetailsView source={content} />
        </div>

        {/* Series navigation */}
        {writing.series && seriesData && (
          <div className="pb-12">
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
