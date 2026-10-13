import type { MusicCatalog, MusicPlaylist } from './types';

export type Catalog = MusicCatalog;
export type PlaylistView = MusicPlaylist & { color?: string };
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
