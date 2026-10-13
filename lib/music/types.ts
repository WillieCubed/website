export interface MusicCatalog {
  version: 1;
  order: string[];
  selected: string[];
  lead: string | null;
  series: { id: string; title: string; playlistIds: string[] }[];
  notes: Record<string, string>;
}
export interface MusicTrack {
  title: string;
  artist: string;
  duration: string;
  durationMs: number | null;
  unavailable?: boolean;
  kind: 'track' | 'episode' | 'local' | 'unavailable';
  url: string | null;
}
export interface MusicPlaylist {
  id: string;
  title: string;
  description: string;
  image: string | null;
  url: string;
  ownerId: string;
  eligible: boolean;
  snapshot: string;
  tracks: MusicTrack[];
  trackCount: number;
  checkedAt: string;
  error: string | null;
}
export interface MusicRevision {
  id: string;
  body: MusicCatalog;
  createdAt: string;
  conflict: boolean;
}
export interface MusicPublication {
  id: string;
  revisionId: string;
  status: 'publishing' | 'deploying' | 'failed' | 'live';
  error: string | null;
  createdAt: string;
  branch?: string;
  base?: string;
  baseFileSha?: string | null;
  sourceSha?: string;
  proposalCommit?: string;
  pullRequestNumber?: number;
  pullRequestUrl?: string;
  commit?: string;
}
export const emptyCatalog: MusicCatalog = {
  version: 1,
  order: [],
  selected: [],
  lead: null,
  series: [],
  notes: {},
};
