import type { MusicCatalog, MusicPlaylist } from './types';

export function visibleCollection(
  catalog: MusicCatalog,
  playlists: MusicPlaylist[],
  now = Date.now()
) {
  const selected = new Set(catalog.selected),
    byId = new Map(
      playlists
        .filter(
          (p) =>
            selected.has(p.id) &&
            p.eligible &&
            Number.isFinite(Date.parse(p.checkedAt)) &&
            Date.parse(p.checkedAt) > now - 86400000
        )
        .map((p) => [p.id, p])
    );
  const order = catalog.order.filter((id) => byId.has(id));
  return {
    catalog: {
      ...catalog,
      order,
      selected: order,
      lead: catalog.lead && byId.has(catalog.lead) ? catalog.lead : null,
      notes: Object.fromEntries(
        Object.entries(catalog.notes).filter(([id]) => byId.has(id))
      ),
      series: catalog.series
        .map((s) => ({
          ...s,
          playlistIds: s.playlistIds.filter((id) => byId.has(id)),
        }))
        .filter((s) => s.playlistIds.length),
    },
    playlists: order.map((id) => byId.get(id)!),
  };
}
