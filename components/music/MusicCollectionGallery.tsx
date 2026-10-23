'use client';

import type { ReactNode } from 'react';

import MusicCollectionHeader from './MusicCollectionHeader';
import type { MusicCollectionView } from './MusicExperienceView';
import MusicGallery, { MusicEmptyCollection } from './MusicGallery';
import MusicPlaylistGrid, {
  type MusicPlaylistGridControls,
} from './MusicPlaylistGrid';
import MusicRail from './MusicRail';
import MusicSeriesNavigation from './MusicSeriesNavigation';
import { galleryItems } from './music-gallery';

export interface MusicGallerySlots {
  rail?: (navigation: ReactNode, publicEmpty: boolean) => ReactNode;
  tools?: (navigation: ReactNode) => ReactNode;
  filters?: ReactNode;
  grid?: MusicPlaylistGridControls;
}
interface Props extends MusicGallerySlots {
  collection: MusicCollectionView;
  editing: boolean;
}
export default function MusicCollectionGallery({
  collection,
  editing,
  rail,
  tools,
  filters,
  grid,
}: Props) {
  const {
    catalog,
    playlists,
    browsing,
    loading = false,
    loadError,
    onRetry,
  } = collection;
  const {
    selection,
    navigation,
    gallery,
    seriesId,
    libraryFilter,
    reordering,
    browseAll,
  } = browsing;
  const { series, matching, displayed, lead } = selection;
  const publicEmpty = selection.publicEmpty && !loading;
  const items = galleryItems({
    displayed,
    playlists,
    catalog,
    lead,
    focused: navigation.focused,
    inSeries: Boolean(series),
    total: matching.length,
    editing,
    loading,
    reordering,
    filterAll: libraryFilter === 'all',
  });
  const seriesNavigation = (
    <MusicSeriesNavigation
      series={catalog.series}
      selected={catalog.selected}
      currentSeriesId={series?.id}
      editing={editing}
      loading={loading}
      playlistCount={playlists.length}
      href={navigation.href}
      chooseSeries={navigation.chooseSeries}
    />
  );
  return (
    <>
      {rail ? (
        rail(seriesNavigation, publicEmpty)
      ) : (
        <MusicRail
          publicEmpty={publicEmpty}
          editing={editing}
          seriesNavigation={seriesNavigation}
        />
      )}
      <MusicGallery
        publicEmpty={publicEmpty}
        loadError={loadError}
        header={
          <MusicCollectionHeader
            series={series}
            editing={editing}
            loading={loading}
            loadError={loadError}
            onRetry={onRetry}
            hasSeries={catalog.series.length > 0}
            count={matching.length}
            tools={tools?.(seriesNavigation)}
          />
        }
        filters={filters}
        empty={
          <MusicEmptyCollection
            loading={loading}
            count={matching.length}
            editing={editing}
            libraryFilter={libraryFilter}
            hasLibrary={playlists.length > 0}
            hasSelection={catalog.selected.length > 0}
            onBrowse={browseAll}
          />
        }
      >
        <MusicPlaylistGrid
          items={items}
          editing={editing}
          loading={loading}
          playlistCount={playlists.length}
          href={(id) => navigation.href(seriesId, id)}
          collectionKey={`${seriesId}:${editing}:${displayed.join(',')}`}
          gallery={gallery}
          onDragStart={grid?.onDragStart}
          onDrop={grid?.onDrop}
          openPlaylist={navigation.openPlaylist}
          controls={grid?.controls}
          pendingControl={grid?.pendingControl}
        />
      </MusicGallery>
    </>
  );
}
