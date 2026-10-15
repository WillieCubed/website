import type { MusicCatalog } from '@/lib/music/types';

export type { MusicSeries } from '@/lib/music/types';

export type CoverStyle =
  | 'tour'
  | 'spring'
  | 'summer'
  | 'winter'
  | 'night'
  | 'loose';

export interface SamplePlaylist {
  id: string;
  title: string;
  cover: CoverStyle;
  coverLabel: string;
  color: string;
  ink: string;
  year: string;
  part?: string;
}

// Fictional artwork has fixed colors, independent of the interface theme.
// These records stay outside authored content and every public loader.
export const playlists: SamplePlaylist[] = [
  {
    id: 'fall-1',
    title: 'Fall Tour 2026, Part 1',
    cover: 'tour',
    coverLabel: 'FALL TOUR',
    color: '#ca482b',
    ink: '#fff3d8',
    year: '2026',
    part: '01',
  },
  {
    id: 'summer',
    title: 'Summer 2026',
    cover: 'summer',
    coverLabel: 'SUMMER',
    color: '#eecb56',
    ink: '#253d63',
    year: '2026',
  },
  {
    id: 'fall-2',
    title: 'Fall Tour 2026, Part 2',
    cover: 'tour',
    coverLabel: 'FALL TOUR',
    color: '#6c7961',
    ink: '#f9eacb',
    year: '2026',
    part: '02',
  },
  {
    id: 'spring',
    title: 'Spring 2026',
    cover: 'spring',
    coverLabel: 'SPRING',
    color: '#cad5bb',
    ink: '#8b352e',
    year: '2026',
  },
  {
    id: 'late-hours',
    title: 'Late hours',
    cover: 'night',
    coverLabel: 'LATE HOURS',
    color: '#332c4c',
    ink: '#e8b399',
    year: '2026',
  },
  {
    id: 'fall-3',
    title: 'Fall Tour 2026, Part 3',
    cover: 'tour',
    coverLabel: 'FALL TOUR',
    color: '#d2a574',
    ink: '#492f35',
    year: '2026',
    part: '03',
  },
  {
    id: 'winter',
    title: 'Winter 2025–26',
    cover: 'winter',
    coverLabel: 'WINTER',
    color: '#c4d6df',
    ink: '#344b58',
    year: '2025–26',
  },
  {
    id: 'loose-ends',
    title: 'Loose ends',
    cover: 'loose',
    coverLabel: 'LOOSE ENDS',
    color: '#d2d985',
    ink: '#3b4030',
    year: '2026',
  },
];

export type Catalog = MusicCatalog;

export const initialCatalog: Catalog = {
  version: 1,
  order: playlists.map((playlist) => playlist.id),
  selected: playlists.slice(0, 7).map((playlist) => playlist.id),
  lead: 'fall-1',
  series: [
    {
      id: 'fall-tour',
      title: 'Fall Tour',
      playlistIds: ['fall-1', 'fall-2', 'fall-3'],
    },
    {
      id: 'seasons',
      title: 'Seasons',
      playlistIds: ['spring', 'summer', 'winter'],
    },
  ],
  notes: {},
};

export const sampleTracks = [
  { title: 'Opening track', artist: 'Sample artist', duration: '4:12' },
  { title: 'Second track', artist: 'Sample artist', duration: '3:48' },
  {
    title: 'Unavailable track',
    artist: 'Its place in the sequence is preserved.',
    duration: '—',
    unavailable: true,
  },
  { title: 'Interlude', artist: 'Sample artist', duration: '1:34' },
  { title: 'Closing track', artist: 'Sample artist', duration: '5:06' },
  { title: 'Opening track', artist: 'Sample artist', duration: '4:12' },
];

export function listeningTime(
  tracks: readonly { duration: string }[]
): string | null {
  const durations = tracks.map((track) => {
    const match = /^(\d+):([0-5]\d)$/.exec(track.duration);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  });
  const known = durations.filter((duration) => duration !== null);
  if (!known.length) return null;
  const minutes = Math.floor(
    known.reduce((total, duration) => total + duration, 0) / 60
  );
  const partial = known.length < tracks.length ? '+' : '';
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} hr ${minutes % 60}${partial} min`
    : `${minutes}${partial} min`;
}

export function moveItem(items: string[], id: string, step: number): string[] {
  const index = items.indexOf(id);
  const destination = index + step;
  if (index < 0 || destination < 0 || destination >= items.length) return items;
  const next = [...items];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

function validLead(lead: unknown, selected: string[]): boolean {
  return lead === null || (typeof lead === 'string' && selected.includes(lead));
}

function validNotes(notes: unknown, known: Set<string>): boolean {
  return (
    !!notes &&
    typeof notes === 'object' &&
    Object.entries(notes).every(
      ([id, note]) => known.has(id) && typeof note === 'string'
    )
  );
}

export function validCatalog(value: unknown): value is Catalog {
  if (!value || typeof value !== 'object') return false;
  const c = value as Catalog;
  const known = new Set(playlists.map((playlist) => playlist.id));
  const ids = (v: unknown): v is string[] =>
    Array.isArray(v) &&
    v.every((id) => typeof id === 'string' && known.has(id)) &&
    new Set(v).size === v.length;
  return (
    ids(c.order) &&
    c.order.length === playlists.length &&
    ids(c.selected) &&
    validLead(c.lead, c.selected) &&
    Array.isArray(c.series) &&
    c.series.every(
      (s) =>
        s &&
        typeof s.id === 'string' &&
        /^[a-z0-9-]+$/.test(s.id) &&
        typeof s.title === 'string' &&
        ids(s.playlistIds)
    ) &&
    new Set(c.series.map((s) => s.id)).size === c.series.length &&
    validNotes(c.notes, known)
  );
}
