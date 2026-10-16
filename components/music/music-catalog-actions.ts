import {
  appendCatalogSeries,
  dropCatalog,
  reorderCatalog,
  toggleCatalogSelection,
} from '@/lib/music/catalog-edits';
import type { Catalog, PlaylistView } from '@/lib/music/presentation';

interface Options {
  draft: Catalog;
  order: string[];
  seriesId: string | null;
  playlists: PlaylistView[];
  changeCatalog: (next: Catalog) => void;
  announce: (message: string) => void;
  chooseSeries: (id: string) => void;
}
/** Apply gallery edits against the current draft and its selected ordering domain. */
export function createMusicCatalogActions({
  draft,
  order,
  seriesId,
  playlists,
  changeCatalog,
  announce,
  chooseSeries,
}: Options) {
  function createSeries(title: string) {
    const id = `series-${crypto.randomUUID()}`;
    changeCatalog(appendCatalogSeries(draft, id, title));
    chooseSeries(id);
  }
  function move(id: string, step: number) {
    changeCatalog(reorderCatalog(draft, id, step, seriesId));
    const title = playlists.find((playlist) => playlist.id === id)?.title;
    announce(`${title} moved ${step < 0 ? 'earlier' : 'later'}.`);
  }
  function drop(source: string, target: string) {
    changeCatalog(dropCatalog(draft, order, source, target, seriesId));
  }
  function select(id: string) {
    changeCatalog(toggleCatalogSelection(draft, id));
  }
  return { createSeries, move, drop, select };
}
