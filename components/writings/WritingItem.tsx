import BookmarkIcon from '@mui/icons-material/Bookmark';
import EventIcon from '@mui/icons-material/Event';
import FavoriteIcon from '@mui/icons-material/Favorite';
import RepeatIcon from '@mui/icons-material/Repeat';

import SiteLink from '@/components/link/SiteLink';

import { formatDate } from '@/lib/site';
import { WritingData } from '@/lib/writings';
import type { PostType } from '@/lib/writings/types';

interface WritingItemProps {
  writing: WritingData;
  /** Series name to display (resolved from slug) */
  seriesName?: string;
  /** Where the series name links; falls back to the writings index. */
  seriesHref?: string;
  /** Whether to show series info (default: true) */
  showSeriesInfo?: boolean;
}

export default function WritingItem({
  writing,
  seriesName,
  seriesHref,
  showSeriesInfo = true,
}: WritingItemProps) {
  const formattedDate = formatDate(writing.published, 'short');

  const publishedIso = new Date(writing.published).toISOString();

  return (
    <article className="h-entry group relative -mx-md max-w-breakpoint-md rounded-lg px-md py-md transition-all duration-200 ease-out hover:translate-x-1 hover:bg-gray-50 dark:hover:bg-gray-900">
      {/* Main link covers the entire card */}
      <SiteLink
        href={`/writings/${writing.slug}`}
        preview={false}
        className="u-url absolute inset-0 z-10"
        aria-label={writing.title}
      />

      <div className="pointer-events-none relative space-y-sm">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 text-label-medium text-gray-500 dark:text-gray-400">
          <time className="dt-published" dateTime={publishedIso}>
            {formattedDate}
          </time>
          {writing.hasExplicitTitle && (
            <>
              <span>·</span>
              <span>{writing.readingTime} min read</span>
            </>
          )}
          {writing.draft && (
            <span className="rounded bg-yellow-100 px-2 py-0.5 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              Draft
            </span>
          )}
        </div>

        {/* Title. Notes have none, so the derived first sentence is the entry text. */}
        {writing.hasExplicitTitle ? (
          <>
            <h2 className="p-name text-title-large transition duration-150 ease-out group-hover:text-primary group-focus:text-primary">
              {writing.title}
            </h2>
            <p className="p-summary text-body-medium text-gray-600 dark:text-gray-400">
              {writing.description}
            </p>
          </>
        ) : (
          <p className="p-name text-body-large transition duration-150 ease-out group-hover:text-primary group-focus:text-primary">
            {writing.title}
          </p>
        )}

        {/* Tags */}
        {writing.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-sm">
            {writing.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="p-category rounded bg-gray-100 px-2 py-0.5 text-label-small text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              >
                {tag}
              </span>
            ))}
            {writing.tags.length > 4 && (
              <span className="text-label-small text-gray-500">
                +{writing.tags.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Series indicator */}
        {showSeriesInfo && writing.series && (
          <div className="pt-sm text-label-medium text-gray-500 dark:text-gray-400">
            Part {writing.series.part} of{' '}
            <SiteLink
              href={seriesHref ?? '/writings'}
              className="link-animated pointer-events-auto relative z-20 font-medium"
            >
              {seriesName || writing.series.slug}
            </SiteLink>
          </div>
        )}
      </div>
    </article>
  );
}
