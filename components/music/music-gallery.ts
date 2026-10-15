import {
  type Catalog,
  type PlaylistView,
  canReorderPlaylists,
} from '@/lib/music/presentation';

export interface MusicSeriesPreview {
  id: string;
  title: string;
  position: number;
  total: number;
  related: PlaylistView[];
}

export interface MusicCardCuration {
  selectionDisabled: boolean;
  reorderHidden: boolean;
  earlierDisabled: boolean;
  laterDisabled: boolean;
}

export interface MusicGalleryItem {
  playlist: PlaylistView;
  selected: boolean;
  featured: boolean;
  focused: boolean;
  index: number;
  total: number;
  inSeries: boolean;
  note: string | undefined;
  memberships: MusicSeriesPreview[];
  canReorder: boolean;
  curation: MusicCardCuration;
}
interface GalleryItemsOptions {
  displayed: string[];
  playlists: PlaylistView[];
  catalog: Catalog;
  lead: string | null;
  focused: string | null;
  inSeries: boolean;
  total: number;
  editing: boolean;
  loading: boolean;
  reordering: boolean;
  filterAll: boolean;
}
export function galleryItems({
  displayed,
  playlists,
  catalog,
  lead,
  focused,
  inSeries,
  total,
  editing,
  loading,
  reordering,
  filterAll,
}: GalleryItemsOptions): MusicGalleryItem[] {
  return displayed.flatMap((id, index) => {
    const playlist = playlists.find((item) => item.id === id);
    if (!playlist) return [];
    const featured = id === lead;
    return [
      {
        playlist,
        index,
        total,
        inSeries,
        featured,
        focused: id === focused,
        selected: catalog.selected.includes(id),
        canReorder: canReorderPlaylists(editing, reordering, filterAll),
        curation: cardCuration(
          playlist,
          catalog.selected.includes(id),
          index,
          total,
          loading,
          reordering,
          filterAll
        ),
        note: featured ? catalog.notes[id]?.trim() : undefined,
        memberships: featured
          ? catalog.series
              .map((series) => ({
                ...series,
                playlistIds: series.playlistIds.filter((member) =>
                  catalog.selected.includes(member)
                ),
              }))
              .filter((series) => series.playlistIds.includes(id))
              .map((series) => ({
                id: series.id,
                title: series.title,
                position: series.playlistIds.indexOf(id) + 1,
                total: series.playlistIds.length,
                related: series.playlistIds
                  .filter((member) => member !== id)
                  .slice(0, 2)
                  .map(
                    (member) =>
                      playlists.find((playlist) => playlist.id === member)!
                  ),
              }))
          : [],
      },
    ];
  });
}

function cardCuration(
  playlist: PlaylistView,
  selected: boolean,
  index: number,
  total: number,
  loading: boolean,
  reordering: boolean,
  filterAll: boolean
): MusicCardCuration {
  return {
    selectionDisabled: loading || (!playlist.eligible && !selected),
    reorderHidden: !reordering || total < 2 || !filterAll,
    earlierDisabled: loading || index === 0 || !filterAll,
    laterDisabled: loading || index === total - 1 || !filterAll,
  };
}
