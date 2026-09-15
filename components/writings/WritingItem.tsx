import BookmarkIcon from '@mui/icons-material/Bookmark';
import EventIcon from '@mui/icons-material/Event';
import FavoriteIcon from '@mui/icons-material/Favorite';
import RepeatIcon from '@mui/icons-material/Repeat';
import Link from 'next/link';

import { WritingData } from '@/lib/writings';
import type { PostType } from '@/lib/writings/types';

const POST_TYPE_CONFIG: Record<
  PostType,
  {
    label: string;
    icon?: typeof FavoriteIcon;
    bgColor?: string;
    textColor?: string;
  }
> = {
  article: { label: 'Article' },
  note: { label: 'Note' },
  photo: { label: 'Photo' },
  like: {
    label: 'Like',
    icon: FavoriteIcon,
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-600 dark:text-red-400',
  },
  repost: {
    label: 'Repost',
    icon: RepeatIcon,
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-600 dark:text-green-400',
  },
  bookmark: {
    label: 'Bookmark',
    icon: BookmarkIcon,
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-600 dark:text-blue-400',
  },
  rsvp: {
    label: 'RSVP',
    icon: EventIcon,
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-600 dark:text-purple-400',
  },
};

interface WritingItemProps {
  writing: WritingData;
  /** Series name to display (resolved from slug) */
  seriesName?: string;
  /** Whether to show series info (default: true) */
  showSeriesInfo?: boolean;
}

export default function WritingItem({
  writing,
  seriesName,
  showSeriesInfo = true,
}: WritingItemProps) {
  const formattedDate = new Date(writing.published).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );

  const publishedIso = new Date(writing.published).toISOString();

  return (
    <article className="h-entry group relative -mx-md max-w-breakpoint-md rounded-lg px-md py-md transition-all duration-200 ease-out hover:translate-x-1 hover:bg-gray-50 dark:hover:bg-gray-900">
      {/* Main link covers the entire card */}
      <Link
        href={`/writings/${writing.slug}`}
        className="u-url absolute inset-0 z-10"
        aria-label={writing.title}
      />

      <div className="pointer-events-none relative space-y-sm">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-2 text-label-medium text-gray-500 dark:text-gray-400">
          {writing.postType !== 'article' && (
            <>
              {(() => {
                const config = POST_TYPE_CONFIG[writing.postType];
                const Icon = config.icon;
                return (
                  <span
                    className={`flex items-center gap-1 rounded px-2 py-0.5 ${config.bgColor || 'bg-primary/10'} ${config.textColor || 'text-primary'}`}
                  >
                    {Icon && <Icon className="size-3.5" />}
                    {config.label}
                  </span>
                );
              })()}
              <span>·</span>
            </>
          )}
          <time className="dt-published" dateTime={publishedIso}>
            {formattedDate}
          </time>
          <span>·</span>
          <span>{writing.readingTime} min read</span>
          {writing.draft && (
            <span className="rounded bg-yellow-100 px-2 py-0.5 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              Draft
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="p-name text-title-large transition duration-150 ease-out group-hover:text-primary group-focus:text-primary">
          {writing.title}
        </h2>

        {/* Description */}
        <p className="p-summary text-body-medium text-gray-600 dark:text-gray-400">
          {writing.description}
        </p>

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
            <Link
              href={`/collections/${writing.series.slug}`}
              className="link-animated pointer-events-auto relative z-20 font-medium"
            >
              {seriesName || writing.series.slug}
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}
