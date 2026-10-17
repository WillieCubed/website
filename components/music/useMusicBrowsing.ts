'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { usePalette } from '@/components/search/palette/PaletteProvider';

import { musicAliases } from '@/lib/music/easter-eggs';
import {
  type Catalog,
  type MusicLibraryFilter,
  type MusicMode,
  type PlaylistView,
  gallerySelection,
} from '@/lib/music/presentation';

import { useMusicPlaylistDialog } from './useMusicPlaylistDialog';

interface Options {
  catalog: Catalog;
  initialCatalog: Catalog;
  initialSeries?: string;
  initialDetail?: string;
  mode: MusicMode;
  editing: boolean;
  playlists: PlaylistView[];
  paletteEnabled: boolean;
}
export function useMusicBrowsing({
  catalog,
  initialCatalog,
  initialSeries,
  initialDetail,
  mode,
  editing,
  playlists,
  paletteEnabled,
}: Options) {
  const [reordering, setReordering] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<MusicLibraryFilter>('all');
  const [seriesId, setSeriesId] = useState<string | null>(
    initialCatalog.series.some((series) => series.id === initialSeries)
      ? initialSeries!
      : null
  );
  const gallery = useRef<HTMLDivElement>(null);
  const selection = gallerySelection(
    catalog,
    mode,
    editing,
    seriesId,
    libraryFilter
  );
  const { displayed } = selection;
  const navigation = useMusicPlaylistDialog({
    catalog,
    mode,
    initialDetail,
    initialCatalog,
    editing,
    playlists,
    displayed,
    gallery,
    seriesId,
    setSeriesId,
    finishReordering: () => setReordering(false),
  });
  useMusicPaletteNavigation({
    enabled: paletteEnabled,
    playlists: catalog.order.flatMap((id) => {
      const playlist = playlists.find((item) => item.id === id);
      return playlist && (editing || catalog.selected.includes(id))
        ? [playlist]
        : [];
    }),
    onOpenPlaylist: openPalettePlaylist,
  });
  function openPalettePlaylist(id: string) {
    const revealAll = !displayed.includes(id);
    const destination = {
      seriesId: revealAll ? null : seriesId,
      playlistIds: revealAll
        ? gallerySelection(catalog, mode, editing, null, 'all').displayed
        : displayed,
    };
    if (revealAll) {
      flushSync(() => {
        clearFilter();
        navigation.chooseSeries(null);
      });
    }
    const source = gallery.current?.querySelector<HTMLElement>(
      `[data-playlist="${id}"] .music-card-open`
    );
    source?.scrollIntoView({ behavior: 'instant', block: 'center' });
    navigation.openPlaylist(id, source ?? undefined, destination);
  }
  function clearFilter() {
    setLibraryFilter('all');
  }
  function chooseFilter(next: MusicLibraryFilter) {
    setLibraryFilter(next);
    setReordering(false);
  }
  function browseAll() {
    clearFilter();
    navigation.chooseSeries(null);
  }
  function editOrder() {
    flushSync(() => {
      clearFilter();
      navigation.chooseSeries(null);
      setReordering(true);
    });
    gallery.current
      ?.querySelector<HTMLButtonElement>(
        '.music-order-buttons button:not(:disabled)'
      )
      ?.focus();
  }
  function resetSelection() {
    clearFilter();
    setSeriesId(null);
  }
  return {
    selection,
    navigation,
    gallery,
    seriesId,
    libraryFilter,
    reordering,
    clearFilter,
    chooseFilter,
    browseAll,
    resetSelection,
    editOrder,
    setReordering,
  };
}
export type MusicBrowsing = ReturnType<typeof useMusicBrowsing>;

interface PlaylistSummary {
  id: string;
  title: string;
}

interface PaletteNavigationOptions {
  enabled: boolean;
  playlists: PlaylistSummary[];
  onOpenPlaylist: (id: string) => void;
}
function useMusicPaletteNavigation({
  enabled,
  playlists,
  onOpenPlaylist,
}: PaletteNavigationOptions) {
  const { close: closePalette, registerCommands } = usePalette();
  useEffect(() => {
    if (!enabled) return;
    return registerCommands(
      playlists.map((playlist) => ({
        id: `music:open:${playlist.id}`,
        title: playlist.title,
        detail: 'Open playlist',
        group: 'Playlists' as const,
        keywords: ['music', 'playlist', ...musicAliases(playlist.id)],
        kind: 'music' as const,
        run: async () => {
          await closePalette({ animate: false, restoreFocus: false });
          onOpenPlaylist(playlist.id);
        },
      }))
    );
  }, [enabled, playlists, onOpenPlaylist, registerCommands, closePalette]);
}
