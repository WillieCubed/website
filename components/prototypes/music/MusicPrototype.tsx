'use client';
import MusicExperience from '@/components/music/MusicExperience';

import type { PlaylistView } from '@/lib/music/presentation';
import {
  initialCatalog,
  playlists,
  sampleTracks,
  validCatalog,
} from '@/lib/prototypes/music';

import SampleCover from './SampleCover';

const data: PlaylistView[] = playlists.map((p) => ({
  ...p,
  description: '',
  image: null,
  url: '',
  ownerId: 'sample',
  eligible: true,
  snapshot: 'sample',
  tracks: sampleTracks.map((t) => ({
    ...t,
    durationMs: null,
    kind: t.unavailable ? 'unavailable' : 'track',
    url: null,
  })),
  trackCount: sampleTracks.length,
  checkedAt: '2026-10-12T00:00:00Z',
  error: null,
}));
function Cover({ playlist }: { playlist: PlaylistView }) {
  return (
    <SampleCover playlist={playlists.find((p) => p.id === playlist.id)!} />
  );
}
export default function MusicPrototype() {
  return (
    <MusicExperience
      mode="prototype"
      playlists={data}
      initialCatalog={initialCatalog}
      validCatalog={validCatalog}
      Cover={Cover}
    />
  );
}
