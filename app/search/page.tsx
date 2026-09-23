import type { Metadata } from 'next/types';
import { Suspense } from 'react';

import SiteSearch from '@/components/SiteSearch';
import TopBar, { COLUMN } from '@/components/site/TopBar';

import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Search',
  description: `Search everything on ${new URL(site.origin).hostname}.`,
  robots: {
    index: false,
    follow: true,
  },
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <>
      <TopBar column="reading" />
      <main id="main" className={`mx-auto pb-2xl pt-lg ${COLUMN.reading}`}>
        <h1 className="mb-xl text-headline-large">Search</h1>
        <p className="search-shortcut-hint mb-lg text-body-medium text-on-surface-variant">
          Press <kbd className="font-mono">⌘K</kbd> (Ctrl+K on Windows and
          Linux) for instant search.
        </p>
        {/* searchParams is request data, so reading it must sit under Suspense
            for the static shell to prerender under Cache Components. */}
        <Suspense fallback={<SiteSearch />}>
          <SearchResults searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function SearchResults({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  return <SiteSearch query={q} />;
}
