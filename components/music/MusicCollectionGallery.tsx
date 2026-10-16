'use client';
import type { ComponentType } from 'react';

import {
  type Catalog,
  type MusicMode,
  type PlaylistView,
  canReorderPlaylists,
} from '@/lib/music/presentation';
import { gallerySelection } from '@/lib/music/presentation';

import MusicCollectionHeader from './MusicCollectionHeader';
import type { MusicCoverProps } from './MusicCover';
import MusicGallery, {
  MusicEmptyCollection,
  MusicLibraryFilters,
} from './MusicGallery';
import MusicPlaylistGrid from './MusicPlaylistGrid';
import MusicRail from './MusicRail';
import MusicSeriesNavigation from './MusicSeriesNavigation';
import { createMusicCatalogActions } from './music-catalog-actions';
import { galleryItems } from './music-gallery';
import type { MusicBrowsing } from './useMusicBrowsing';
import type { MusicPlaylistNavigation } from './useMusicPlaylistDialog';
import { useMusicPlaylistDrag } from './useMusicPlaylistDrag';

type MusicGalleryBrowsing = Pick<
  MusicBrowsing,
  | 'gallery'
  | 'seriesId'
  | 'libraryFilter'
  | 'reordering'
  | 'chooseFilter'
  | 'browseAll'
  | 'setReordering'
>;
type MusicGalleryNavigation = Pick<
  MusicPlaylistNavigation,
  'focused' | 'href' | 'chooseSeries' | 'openPlaylist'
>;
type MusicGallerySelection = ReturnType<typeof gallerySelection>;
interface Props {
  catalog: Catalog;
  playlists: PlaylistView[];
  mode: MusicMode;
  editing: boolean;
  loading: boolean;
  loadError?: string;
  storageError: string;
  onRetry?: () => void;
  Cover?: ComponentType<MusicCoverProps>;
  selection: MusicGallerySelection;
  browsing: MusicGalleryBrowsing;
  navigation: MusicGalleryNavigation;
  draft: Catalog;
  onChange: (next: Catalog) => void;
  announce: (message: string) => void;
}
export default function MusicCollectionGallery({
  catalog,
  playlists,
  mode,
  editing,
  loading,
  loadError,
  storageError,
  onRetry,
  Cover,
  selection,
  browsing,
  navigation,
  draft,
  onChange,
  announce,
}: Props) {
  const { series, matching, displayed, lead } = selection;
  const {
    gallery,
    seriesId,
    libraryFilter,
    reordering,
    chooseFilter,
    browseAll,
    setReordering,
  } = browsing;
  const edits = createMusicCatalogActions({
    draft,
    order: selection.order,
    seriesId: series?.id ?? null,
    playlists,
    changeCatalog: onChange,
    announce,
    chooseSeries: navigation.chooseSeries,
  });
  const publicEmpty = selection.publicEmpty && !loading;
  const drag = useMusicPlaylistDrag({
    enabled: canReorderPlaylists(editing, reordering, libraryFilter === 'all'),
    onDrop: edits.drop,
  });
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
      <MusicRail
        publicEmpty={publicEmpty}
        editing={editing}
        loading={loading}
        seriesNavigation={seriesNavigation}
        onCreateSeries={edits.createSeries}
      />
      <MusicGallery
        publicEmpty={publicEmpty}
        loadError={loadError}
        storageError={storageError}
        mode={mode}
        header={
          <MusicCollectionHeader
            series={series}
            editing={editing}
            loading={loading}
            loadError={loadError}
            onRetry={onRetry}
            hasSeries={catalog.series.length > 0}
            count={matching.length}
            reordering={reordering}
            filterAll={libraryFilter === 'all'}
            onToggleReordering={() => setReordering(!reordering)}
            seriesNavigation={seriesNavigation}
          />
        }
        filters={
          <MusicLibraryFilters
            editing={editing}
            libraryFilter={libraryFilter}
            setLibraryFilter={chooseFilter}
            loading={loading}
          />
        }
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
          Cover={Cover}
          onDragStart={drag.start}
          onDrop={drag.drop}
          openPlaylist={navigation.openPlaylist}
          select={edits.select}
          reorder={edits.move}
        />
      </MusicGallery>
    </>
  );
}
