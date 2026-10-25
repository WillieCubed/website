'use client';

import type { Catalog, PlaylistView } from '@/lib/music/presentation';

import MusicExperienceView from './MusicExperienceView';
import { useMusicBrowsing } from './useMusicBrowsing';

interface Props {
  playlists: PlaylistView[];
  initialCatalog: Catalog;
  initialSeries?: string;
  initialDetail?: string;
  loading?: boolean;
  loadError?: string;
}
export default function MusicPublicExperience({
  playlists,
  initialCatalog,
  initialSeries,
  initialDetail,
  loading = false,
  loadError,
}: Props) {
  const browsing = useMusicBrowsing({
    catalog: initialCatalog,
    initialCatalog,
    initialSeries,
    initialDetail,
    playlists,
    mode: 'public',
    editing: false,
    paletteEnabled: true,
  });
  return (
    <MusicExperienceView
      collection={{
        catalog: initialCatalog,
        playlists,
        browsing,
        initialDetail,
        loading,
        loadError,
      }}
    />
  );
}
