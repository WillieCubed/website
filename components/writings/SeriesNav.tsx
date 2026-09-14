import Link from 'next/link';

import { SeriesDefinition, WritingData } from '@/lib/writings';

interface SeriesNavProps {
  series: SeriesDefinition;
  writings: WritingData[];
  currentPart: number;
}

export default function SeriesNav({
  series,
  writings,
  currentPart,
}: SeriesNavProps) {
  const prevWriting = writings.find((w) => w.series?.part === currentPart - 1);
  const nextWriting = writings.find((w) => w.series?.part === currentPart + 1);
  const totalParts = writings.length;

  return (
    <nav className="rounded-lg border border-outline-variant bg-surface-container p-lg">
      <div className="space-y-md">
        {/* Series header */}
        <div className="flex items-center justify-between">
          <Link
            href={`/collections/${series.slug}`}
            className="link-animated text-label-large font-medium"
          >
            {series.name}
          </Link>
          <span className="text-label-medium text-on-surface-variant">
            Part {currentPart} of {totalParts}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 overflow-hidden rounded-full bg-outline-variant">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(currentPart / totalParts) * 100}%` }}
          />
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between gap-md">
          {prevWriting ? (
            <Link
              href={`/writings/${prevWriting.slug}`}
              className="group flex flex-1 flex-col items-start rounded-md p-sm transition-colors hover:bg-surface-container-high"
            >
              <span className="text-label-small text-on-surface-variant">
                &larr; Previous
              </span>
              <span className="text-title-small group-hover:text-primary">
                {prevWriting.title}
              </span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}

          {nextWriting ? (
            <Link
              href={`/writings/${nextWriting.slug}`}
              className="group flex flex-1 flex-col items-end rounded-md p-sm text-right transition-colors hover:bg-surface-container-high"
            >
              <span className="text-label-small text-on-surface-variant">
                Next &rarr;
              </span>
              <span className="text-title-small group-hover:text-primary">
                {nextWriting.title}
              </span>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </div>
    </nav>
  );
}
