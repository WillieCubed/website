import type { Metadata } from 'next/types';
import { Suspense } from 'react';

import SiteSearch from '@/components/SiteSearch';

import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Search',
  description: `Search every writing on ${new URL(site.origin).hostname}.`,
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
    <main className="mx-auto max-w-2xl px-lg py-2xl">
      <h1 className="mb-xl text-headline-large">Search</h1>
      {/* searchParams is request data, so reading it must sit under Suspense
          for the static shell to prerender under Cache Components. */}
      <Suspense fallback={<SiteSearch />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchResults({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  return <SiteSearch query={q} />;
}
