import { MDXRemote } from 'next-mdx-remote/rsc';
import Link from 'next/link';

import { mdxComponents } from '@/components/mdx';
import WritingItem from '@/components/writings/WritingItem';

import type { SeriesWithWritings } from '@/lib/collections';

interface CollectionContentProps {
  series: SeriesWithWritings;
  typeDisplayName: string;
  /** Whether this is displayed in a modal context */
  isModal?: boolean;
}

/**
 * Shared content component for displaying a series collection.
 * Used by both the full page and modal views.
 */
export default function CollectionContent({
  series,
  typeDisplayName,
  isModal = false,
}: CollectionContentProps) {
  return (
    <>
      {/* Header */}
      <header
        className={
          isModal
            ? 'space-y-md pb-lg'
            : 'mx-auto max-w-breakpoint-md px-lg pb-lg pt-16 desktop:px-0'
        }
      >
        <div className="space-y-md">
          {!isModal && (
            <Link
              href="/collections"
              className="link-animated text-label-large"
            >
              &larr; All collections
            </Link>
          )}

          <div className="flex items-center gap-sm">
            <span className="rounded bg-surface-container px-2 py-0.5 text-label-medium text-on-surface-variant">
              {typeDisplayName}
            </span>
          </div>

          <h1
            className={isModal ? 'text-display-small' : 'text-display-small'}
            id="collection-title"
          >
            {series.name}
          </h1>

          <p className="text-headline-small text-on-surface-variant">
            {series.description}
          </p>

          <div className="flex flex-wrap items-center gap-md text-label-large text-on-surface-variant">
            <span>
              {series.totalParts} {series.totalParts === 1 ? 'part' : 'parts'}
            </span>
            {series.complete && (
              <span className="rounded bg-primary/10 px-2 py-1 text-primary">
                Complete
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Series introduction content */}
      {series.content.trim() && (
        <section
          className={
            isModal
              ? 'pb-xl'
              : 'mx-auto max-w-breakpoint-md px-lg pb-xl desktop:px-0'
          }
        >
          <article className="prose prose-lg max-w-none dark:prose-invert">
            <MDXRemote source={series.content} components={mdxComponents} />
          </article>
        </section>
      )}

      {/* Posts in series */}
      <section
        className={
          isModal
            ? 'pb-lg'
            : 'mx-auto max-w-breakpoint-md px-lg pb-2xl desktop:px-0'
        }
      >
        <h2 className="mb-lg text-title-large">Posts in this series</h2>

        {series.writings.length === 0 ? (
          <p className="text-body-medium text-on-surface-variant">
            No posts in this series yet. Check back soon!
          </p>
        ) : (
          <div className="space-y-md">
            {series.writings.map((writing, index) => (
              <div key={writing.slug} className="flex gap-md">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-label-large text-on-primary">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <WritingItem writing={writing} showSeriesInfo={false} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
