'use client';

import { type Catalog, canReorderPlaylists } from '@/lib/music/presentation';

import MusicAdminRail from './MusicAdminRail';
import MusicCardControls from './MusicCardControls';
import type { MusicGallerySlots } from './MusicCollectionGallery';
import { CollectionPicker, ReorderToggle } from './MusicCollectionTools';
import type { MusicCollectionView } from './MusicExperienceView';
import { MusicLibraryFilters } from './MusicGallery';
import MusicSelectionControl from './MusicSelectionControl';
import { createMusicCatalogActions } from './music-catalog-actions';
import { useMusicPlaylistDrag } from './useMusicPlaylistDrag';

interface Options {
  collection: MusicCollectionView;
  editing: boolean;
  onChange: (next: Catalog) => void;
  announce: (message: string) => void;
}
export function useMusicGalleryCuration({
  collection,
  editing,
  onChange,
  announce,
}: Options): MusicGallerySlots {
  const { catalog: draft, playlists, browsing, loading = false } = collection;
  const { selection, navigation } = browsing;
  const { series, matching } = selection;
  const { libraryFilter, reordering } = browsing;
  const edits = createMusicCatalogActions({
    draft,
    order: selection.order,
    seriesId: series?.id ?? null,
    playlists,
    changeCatalog: onChange,
    announce,
    chooseSeries: navigation.chooseSeries,
  });
  const drag = useMusicPlaylistDrag({
    enabled: canReorderPlaylists(editing, reordering, libraryFilter === 'all'),
    onDrop: edits.drop,
  });
  return {
    rail: (seriesNavigation, publicEmpty) => (
      <MusicAdminRail
        publicEmpty={publicEmpty}
        editing={editing}
        loading={loading}
        seriesNavigation={seriesNavigation}
        onCreateSeries={edits.createSeries}
      />
    ),
    tools: (seriesNavigation) => (
      <>
        <CollectionPicker
          visible={editing && draft.series.length > 0}
          title={series?.title}
          count={matching.length}
          loading={loading}
        >
          {seriesNavigation}
        </CollectionPicker>
        <ReorderToggle
          visible={editing}
          reordering={reordering}
          loading={loading}
          count={matching.length}
          filterAll={libraryFilter === 'all'}
          onToggle={() => browsing.setReordering(!reordering)}
        />
      </>
    ),
    filters: (
      <MusicLibraryFilters
        editing={editing}
        libraryFilter={libraryFilter}
        setLibraryFilter={browsing.chooseFilter}
        loading={loading}
      />
    ),
    grid: {
      onDragStart: drag.start,
      onDrop: drag.drop,
      controls: (item) =>
        editing && (
          <MusicCardControls
            playlist={item.playlist}
            selected={item.selected}
            controls={item.curation}
            select={edits.select}
            reorder={edits.move}
          />
        ),
      pendingControl: editing && (
        <div className="music-card-controls">
          <label className="music-check">
            <MusicSelectionControl disabled tabIndex={-1} />
            <span className="music-pending-line music-pending-control" />
          </label>
        </div>
      ),
    },
  };
}
