import type { Metadata } from 'next';
import { connection } from 'next/server';

import MusicExperience from '@/components/music/MusicExperience';

import { publicCollection } from '@/lib/music/public';
import { canonicalUrl } from '@/lib/site/urls';

export async function generateMetadata({
  searchParams,
}: PageProps<'/music'>): Promise<Metadata> {
  const { detail } = await searchParams;
  const detailId = Array.isArray(detail) ? detail[0] : detail;
  let title = 'Music';
  if (detailId) {
    const collection = await publicCollection();
    title = collection.playlists.find((p) => p.id === detailId)?.title ?? title;
  }
  return {
    title,
    description:
      'Willie Chalmers III’s taste in music, collected in playlists and series.',
    alternates: { canonical: canonicalUrl('/music') },
  };
}
export default async function Music({ searchParams }: PageProps<'/music'>) {
  const params = await searchParams;
  await connection();
  const data = await publicCollection();
  return (
    <MusicExperience
      playlists={data.playlists}
      initialSeries={
        Array.isArray(params.series) ? params.series[0] : params.series
      }
      initialDetail={
        Array.isArray(params.detail) ? params.detail[0] : params.detail
      }
      initialCatalog={data.catalog}
      loadError={
        'unavailable' in data && data.unavailable
          ? 'The collection couldn’t be loaded. Try again, or explore my playlists on Spotify.'
          : undefined
      }
    />
  );
}
