import type { Metadata } from 'next';
import { connection } from 'next/server';

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
      'Willie Chalmers III’s taste in music, collected in playlists and series.',
    alternates: { canonical: canonicalUrl('/music') },
  };
}
export default async function Music({
  searchParams,
}: {
  searchParams: Promise<{ series?: string; detail?: string }>;
}) {
  const params = await searchParams;
  await connection();
  const data = await publicCollection();
  return (
    <MusicExperience
      playlists={data.playlists}
      initialSeries={params.series}
      initialDetail={params.detail}
      initialCatalog={data.catalog}
      loadError={
        'unavailable' in data && data.unavailable
          ? 'The collection couldn’t be loaded. Try again, or explore my playlists on Spotify.'
          : undefined
      }
    />
  );
}
