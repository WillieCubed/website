import Link from 'next/link';
import type { Metadata } from 'next/types';
import { Suspense } from 'react';

import WritingItem from '@/components/writings/WritingItem';

import {
  getAllSeries,
  getAllTags,
  getAllWritings,
  getWritingsByTag,
} from '@/lib/writings';

export const metadata: Metadata = {
  title: 'Writings',
  description:
    'Thoughts, tutorials, and notes on software, music, and creativity.',
  openGraph: {
    title: "Willie's Writings",
    description:
      'Thoughts, tutorials, and notes on software, music, and creativity.',
    url: '/writings',
  },
  alternates: {
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
};

interface WritingsPageProps {
  searchParams: Promise<{
    tag?: string;
  }>;
}

async function WritingsList({ tag }: { tag?: string }) {
  const [writings, allSeries] = await Promise.all([
    tag ? getWritingsByTag(tag) : getAllWritings(),
    getAllSeries(),
  ]);

  // Build a map of series slug -> name for quick lookup
  const seriesNameMap = new Map(allSeries.map((s) => [s.slug, s.name]));

  if (writings.length === 0) {
    return (
      <div className="py-12 text-center text-body-medium text-gray-500 dark:text-gray-400">
        No writings found{tag && ` with tag "${tag}"`}.
      </div>
    );
  }

  return (
    <div className="space-y-md">
      {writings.map((writing) => (
        <WritingItem
          key={writing.slug}
          writing={writing}
          seriesName={
            writing.series ? seriesNameMap.get(writing.series.slug) : undefined
          }
        />
      ))}
    </div>
  );
}

async function TagFilter({ currentTag }: { currentTag?: string }) {
  const tags = await getAllTags();

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/writings"
        className={`rounded-full px-4 py-2 text-label-large transition-colors ${
          !currentTag
            ? 'bg-primary text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
      >
        All
      </Link>
      {tags.map((tag) => (
        <Link
          key={tag}
          href={`/writings?tag=${encodeURIComponent(tag)}`}
          className={`rounded-full px-4 py-2 text-label-large transition-colors ${
            currentTag === tag
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
          }`}
        >
          {tag}
        </Link>
      ))}
    </div>
  );
}

export default function WritingsPage({ searchParams }: WritingsPageProps) {
  return (
    <main className="h-feed mx-auto max-w-breakpoint-2xl tablet:grid tablet:grid-cols-8 tablet:gap-lg">
      <section className="mt-16 tablet:col-span-6 tablet:col-start-2">
        <div className="space-y-xl px-lg desktop-large:px-0">
          <div className="space-y-md">
            <h1 className="p-name text-display-small">Writings</h1>
            <p className="text-headline-medium text-gray-600 dark:text-gray-400">
              Thoughts, tutorials, and notes.
            </p>
          </div>
          <div className="space-y-sm text-body-medium">
            <p>
              Technical deep-dives, creative explorations, and everything in
              between. Subscribe via{' '}
              <a
                href="/feed.xml"
                className="text-primary underline-offset-2 hover:underline"
              >
                RSS
              </a>
              .
            </p>
          </div>
        </div>
      </section>
      <Suspense fallback={<WritingsContentFallback />}>
        <WritingsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function WritingsContentFallback() {
  return (
    <>
      <section className="px-lg pt-xl tablet:col-span-6 tablet:col-start-2 desktop-large:px-0">
        <div className="h-10" />
      </section>
      <section className="min-h-[50vh] space-y-lg px-lg pb-2xl pt-xl tablet:col-span-6 tablet:col-start-2 desktop-large:px-0">
        <div className="space-y-md">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      </section>
    </>
  );
}

async function WritingsContent({ searchParams }: WritingsPageProps) {
  const params = await searchParams;
  const { tag } = params;

  return (
    <>
      {/* Tag filters */}
      <section className="px-lg pt-xl tablet:col-span-6 tablet:col-start-2 desktop-large:px-0">
        <Suspense fallback={<div className="h-10" />}>
          <TagFilter currentTag={tag} />
        </Suspense>
      </section>

      {/* Writings list */}
      <section className="min-h-[50vh] space-y-lg px-lg pb-2xl pt-xl tablet:col-span-6 tablet:col-start-2 desktop-large:px-0">
        <Suspense
          fallback={
            <div className="space-y-md">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
                />
              ))}
            </div>
          }
        >
          <WritingsList tag={tag} />
        </Suspense>
      </section>
    </>
  );
}
