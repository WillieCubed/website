import type { Metadata } from 'next/types';

import SiteSearch from '@/components/search/SiteSearch';
import TopBar, { COLUMN } from '@/components/site/TopBar';

import { SEARCH_PAGE } from '@/lib/entities/pages';
import { pageMetadata } from '@/lib/seo/metadata';

// Kept out of the index on purpose: a results page for every query would
// crowd out the pages it links to. The canonical drops the query.
export const metadata: Metadata = pageMetadata({
  title: SEARCH_PAGE.title,
  description: SEARCH_PAGE.description,
  path: SEARCH_PAGE.href,
  noIndex: true,
});

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  return (
    <>
      <TopBar column="reading" />
      <main id="main" className={`mx-auto pb-2xl pt-lg ${COLUMN.reading}`}>
        <h1 className="mb-xl text-headline-large">Search</h1>
        <p className="search-shortcut-hint mb-lg text-body-medium text-on-surface-variant">
          Press <kbd className="font-mono">⌘K</kbd> (Ctrl+K on Windows and
          Linux) for instant search.
        </p>
        <SiteSearch query={q} />
      </main>
    </>
  );
}
