import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';

import MusicExperience from '@/components/music/MusicExperience';

import { publicCollection } from '@/lib/music/public';
import { canonicalUrl } from '@/lib/site/urls';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ detail?: string }>;
}): Promise<Metadata> {
  const { detail } = await searchParams;
  let title = 'Music';
  if (detail) {
    const collection = await publicCollection();
    title = collection.playlists.find((p) => p.id === detail)?.title ?? title;
  }
  return {
    title,
    description:
      'Playlists, compilations, and series selected by Willie Chalmers III.',
    alternates: { canonical: canonicalUrl('/music') },
  };
}
async function Gallery() {
  await connection();
  const data = await publicCollection();
  return (
    <MusicExperience playlists={data.playlists} initialCatalog={data.catalog} />
  );
}
export default function Music() {
  return (
    <Suspense
      fallback={
        <main id="main" className="mp-shell">
          <h1>Music</h1>
          <p>Loading the collection…</p>
        </main>
      }
    >
      <Gallery />
    </Suspense>
  );
}
