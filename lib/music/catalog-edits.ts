import { moveItem } from './presentation';
import type { MusicCatalog } from './types';

/** Keep authored order and append each newly imported playlist once. */
export function appendImportedPlaylistOrder(
  catalog: MusicCatalog,
  playlistIds: string[]
): MusicCatalog {
  const additions = [...new Set(playlistIds)].filter(
    (id) => !catalog.order.includes(id)
  );
  return additions.length === 0
    ? catalog
    : { ...catalog, order: [...catalog.order, ...additions] };
}

export function toggleCatalogSelection(
  catalog: MusicCatalog,
  id: string
): MusicCatalog {
  const selected = catalog.selected.includes(id)
    ? catalog.selected.filter((item) => item !== id)
    : [...catalog.selected, id];
  return {
    ...catalog,
    selected,
    lead: selected.includes(catalog.lead ?? '') ? catalog.lead : null,
  };
}

export function toggleCatalogFeature(
  catalog: MusicCatalog,
  id: string
): MusicCatalog {
  return {
    ...catalog,
    lead: catalog.lead === id ? null : id,
    selected: catalog.selected.includes(id)
      ? catalog.selected
      : [...catalog.selected, id],
  };
}

export function updateCatalogNote(
  catalog: MusicCatalog,
  id: string,
  note: string
): MusicCatalog {
  return { ...catalog, notes: { ...catalog.notes, [id]: note } };
}

export function toggleCatalogMembership(
  catalog: MusicCatalog,
  seriesId: string,
  member: string
): MusicCatalog {
  return {
    ...catalog,
    series: catalog.series.map((series) =>
      series.id !== seriesId
        ? series
        : {
            ...series,
            playlistIds: series.playlistIds.includes(member)
              ? series.playlistIds.filter((id) => id !== member)
              : [...series.playlistIds, member],
          }
    ),
  };
}

export function reorderCatalog(
  catalog: MusicCatalog,
  id: string,
  step: number,
  seriesId: string | null
): MusicCatalog {
  if (seriesId !== null)
    return {
      ...catalog,
      series: catalog.series.map((series) =>
        series.id === seriesId
          ? { ...series, playlistIds: moveItem(series.playlistIds, id, step) }
          : series
      ),
    };
  return { ...catalog, order: moveItem(catalog.order, id, step) };
}

export function dropCatalog(
  catalog: MusicCatalog,
  order: string[],
  source: string,
  target: string,
  seriesId: string | null
): MusicCatalog {
  const next = [...order];
  next.splice(next.indexOf(source), 1);
  next.splice(next.indexOf(target), 0, source);
  if (seriesId !== null)
    return {
      ...catalog,
      series: catalog.series.map((series) =>
        series.id === seriesId ? { ...series, playlistIds: next } : series
      ),
    };
  return { ...catalog, order: next };
}

export function appendCatalogSeries(
  catalog: MusicCatalog,
  id: string,
  title: string
): MusicCatalog {
  return {
    ...catalog,
    series: [...catalog.series, { id, title, playlistIds: [] }],
  };
}
