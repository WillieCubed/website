import type { Metadata } from 'next/types';
import { Suspense } from 'react';

import Icon from '@/components/icons/Icon';
import FeedAuthor from '@/components/indieweb/FeedAuthor';
import SiteLink from '@/components/link/SiteLink';
import TopBar from '@/components/site/TopBar';
import WritingItem from '@/components/writings/WritingItem';

import { absoluteUrl, pageMetadata, site } from '@/lib/site';
import {
  getAllTags,
  getAllWritings,
  getSeries,
  getWritingsByTag,
} from '@/lib/writings';

const writingsMetadata = pageMetadata({
  title: 'Writings',
  description:
    'Thoughts, tutorials, and notes on software, music, and creativity.',
  path: '/writings',
  image: '/writings/opengraph-image',
  imageAlt: 'Writings by Willie Chalmers III',
});

export const metadata: Metadata = {
  ...writingsMetadata,
  alternates: {
    ...writingsMetadata.alternates,
    types: {
      'application/rss+xml': '/writings/feed.xml',
      'application/atom+xml': '/writings/feed/atom',
      'application/feed+json': '/writings/feed/json',
    },
  },
};

interface WritingsPageProps {
  searchParams: Promise<{
    tag?: string;
  }>;
}

async function WritingsList({ tag }: { tag?: string }) {
  const writings = tag ? await getWritingsByTag(tag) : await getAllWritings();

  // Resolve every series a listed writing belongs to. A series can be a file
  // in content/series/ or an initiative, and getSeries handles both.
  const seriesSlugs = [
    ...new Set(writings.flatMap((w) => (w.series ? [w.series.slug] : []))),
  ];
  const seriesMap = new Map(
    await Promise.all(
      seriesSlugs.map(async (slug) => {
        const series = await getSeries(slug).catch(() => null);
        return [slug, series] as const;
      })
    )
  );

  if (writings.length === 0) {
    return (
      <p className="text-body-large text-muted">
        {tag ? `Nothing tagged “${tag}”.` : 'Nothing published yet.'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {writings.map((writing) => (
        <WritingItem
          key={writing.slug}
          writing={writing}
          seriesName={
            writing.series
              ? seriesMap.get(writing.series.slug)?.name
              : undefined
          }
          seriesHref={
            writing.series
              ? seriesMap.get(writing.series.slug)?.href
              : undefined
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
    <div className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5 medium:mx-0 medium:flex-wrap medium:overflow-visible medium:px-0">
      <Icon name="tag" size={14} className="shrink-0 text-muted" />
      <SiteLink
        href="/writings"
        className={`shrink-0 rounded-full px-3 py-1.5 text-label-large transition-colors ${
          !currentTag
            ? 'bg-primary text-on-primary'
            : 'border border-line bg-card text-ink hover:border-accent hover:text-accent'
        }`}
      >
        All
      </SiteLink>
      {tags.map((tag) => (
        <SiteLink
          key={tag}
          href={`/writings?tag=${encodeURIComponent(tag)}`}
          className={`shrink-0 rounded-full px-3 py-1.5 text-label-large transition-colors ${
            currentTag === tag
              ? 'bg-primary text-on-primary'
              : 'border border-line bg-card text-ink hover:border-accent hover:text-accent'
          }`}
        >
          {tag}
        </SiteLink>
      ))}
    </div>
  );
}

export default function WritingsPage({ searchParams }: WritingsPageProps) {
  return (
    <>
      <TopBar
        column="content"
        crumbs={[{ label: 'Writings', href: '/writings' }]}
      />
      <main id="main" className="h-feed mx-auto max-w-[840px] px-5 pb-8">
        {/* h-feed: u-url so parsers know which page this feed is, and
            p-author so they know whose it is */}
        <a href={absoluteUrl('/writings')} className="u-url hidden" />
        <FeedAuthor />
        <section className="mt-6">
          <div className="space-y-xl">
            <h1 className="p-name text-display-small">Writings</h1>
          </div>
        </section>
        <Suspense fallback={<WritingsContentFallback />}>
          <WritingsContent searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

function WritingsContentFallback() {
  return (
    <>
      <section className="px-lg pt-xl tablet:col-span-6 tablet:col-start-2 desktop-large:px-0">
        <div className="h-10" />
      </section>
      <section className="min-h-[50vh] space-y-lg pb-xl pt-lg">
        <div className="space-y-md">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-card" />
          ))}
        </div>
      </section>
    </>
  );
}

async function WritingsContent({ searchParams }: WritingsPageProps) {
  const params = await searchParams;
  const { tag } = params;
  // With nothing published there is nothing to filter or search.
  const published = await getAllWritings();

  return (
    <>
      {/* Writings list */}
      <section className="pb-6 pt-lg">
        <Suspense
          fallback={
            <div className="space-y-md">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-2xl bg-card"
                />
              ))}
            </div>
          }
        >
          <WritingsList tag={tag} />
        </Suspense>
      </section>
      {published.length > 0 && (
        <section className="flex flex-col gap-4 medium:flex-row medium:flex-wrap medium:items-center medium:justify-between">
          <Suspense fallback={<div className="h-10" />}>
            <TagFilter currentTag={tag} />
          </Suspense>
          <form action="/search" className="flex items-center gap-2">
            <label htmlFor="writings-search" className="sr-only">
              Search
            </label>
            <input
              id="writings-search"
              name="q"
              type="search"
              placeholder="Search"
              className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2 text-body-medium text-ink medium:w-44 medium:flex-none medium:py-1.5"
            />
            <button
              type="submit"
              aria-label="Search"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary medium:size-9"
            >
              <Icon name="search" size={16} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
