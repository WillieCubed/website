import type { MusicCatalog, MusicPlaylist } from './types';

export type MusicMode = 'admin' | 'public';
export type MusicLibraryFilter = 'all' | 'selected' | 'unselected';

export type Catalog = MusicCatalog;
export type PlaylistView = MusicPlaylist & { color?: string };

/** The studio previews its draft; the public page reads the applied catalog. */
export function catalogForViewing(
  live: Catalog,
  draft: Catalog,
  mode: MusicMode
): Catalog {
  return mode === 'admin' ? draft : live;
}

/** Filtered lists cannot be reordered without changing the hidden sequence. */
export function canReorderPlaylists(
  editing: boolean,
  reordering: boolean,
  hasCompleteOrder: boolean
): boolean {
  return editing && reordering && hasCompleteOrder;
}
export function listeningTime(
  tracks: readonly { duration: string }[]
): string | null {
  const durations = tracks.map((track) => {
    const match = /^(\d+):([0-5]\d)$/.exec(track.duration);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  });
  const known = durations.filter((duration) => duration !== null);
  if (known.length === 0) return null;
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

export function gallerySelection(
  catalog: Catalog,
  mode: MusicMode,
  editing: boolean,
  seriesId: string | null,
  libraryFilter: MusicLibraryFilter
) {
  const publicEmpty = mode === 'public' && catalog.selected.length === 0;
  const series = catalog.series.find((item) => item.id === seriesId);
  const order = series?.playlistIds ?? catalog.order;
  const visibleIds = order.filter(
    (id) => editing || catalog.selected.includes(id)
  );
  const matching = visibleIds.filter(
    (id) =>
      !editing ||
      libraryFilter === 'all' ||
      catalog.selected.includes(id) === (libraryFilter === 'selected')
  );
  const lead =
    !series && !editing && catalog.lead && matching.includes(catalog.lead)
      ? catalog.lead
      : null;
  const displayed = lead
    ? [lead, ...matching.filter((id) => id !== lead)]
    : matching;
  return { publicEmpty, series, order, visibleIds, matching, lead, displayed };
}
