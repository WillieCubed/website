'use client';

import {
  toggleCatalogFeature,
  toggleCatalogMembership,
  toggleCatalogSelection,
  updateCatalogNote,
} from '@/lib/music/catalog-edits';
import {
  type Catalog,
  type MusicMode,
  type PlaylistView,
  listeningTime,
} from '@/lib/music/presentation';
import type { MusicSeries } from '@/lib/music/types';

import MusicDetailNavigation from './MusicDetailNavigation';
import {
  MusicPlaylistArtwork,
  MusicPlaylistEditor,
  MusicPlaylistSummary,
  MusicPlaylistTracks,
} from './MusicPlaylistDetails';
import { detailDialogKeyDown } from './music-dialog';
import type { MusicPlaylistNavigation } from './useMusicPlaylistDialog';

interface Props {
  initialDetail?: string;
  mode: MusicMode;
  editing: boolean;
  catalog: Catalog;
  draft: Catalog;
  playlists: PlaylistView[];
  reordering: boolean;
  closeHref: string;
  series: MusicSeries | undefined;
  navigation: MusicPlaylistNavigation;
  onChange: (next: Catalog) => void;
}
export default function MusicDetail({
  initialDetail,
  mode,
  editing,
  catalog,
  draft,
  playlists,
  reordering,
  closeHref,
  series,
  navigation,
  onChange,
}: Props) {
  const {
    focused,
    dialog,
    backdrop,
    currentIndex,
    focusIds,
    openPlaylist,
    closePlaylist,
    openRelatedPlaylist,
  } = navigation;
  const current = playlists.find((playlist) => playlist.id === focused);
  return (
    <dialog
      ref={dialog}
      open={initialDetail && focused === initialDetail ? true : undefined}
      className="mp-detail"
      data-editing={editing || undefined}
      data-reordering={(editing && reordering) || undefined}
      aria-labelledby="mp-detail-title"
      onKeyDown={(event) => detailDialogKeyDown(event, dialog.current)}
      onCancel={(event) => {
        event.preventDefault();
        closePlaylist();
      }}
      {...backdrop}
    >
      {current && (
        <>
          <MusicDetailNavigation
            index={currentIndex}
            ids={focusIds}
            series={series}
            onOpen={openPlaylist}
            onClose={closePlaylist}
            closeHref={closeHref}
            title={current.title}
            playlistId={current.id}
            dialog={dialog}
          />
          <div
            className="mp-detail-scroll scroller"
            role="region"
            aria-label="Playlist details"
            tabIndex={-1}
          >
            <MusicPlaylistSummary
              playlist={current}
              runtime={listeningTime(current.tracks)}
              note={editing ? undefined : catalog.notes[current.id]}
            />
            <MusicPlaylistArtwork
              playlist={current}
              series={catalog.series}
              editing={editing}
              onToggleMembership={(id) =>
                onChange(toggleCatalogMembership(draft, id, current.id))
              }
            />
            {editing && (
              <MusicPlaylistEditor
                playlistId={current.id}
                draft={draft}
                onUpdateNote={(note) =>
                  onChange(updateCatalogNote(draft, current.id, note))
                }
                onToggleSelection={() =>
                  onChange(toggleCatalogSelection(draft, current.id))
                }
                onToggleFeature={() =>
                  onChange(toggleCatalogFeature(draft, current.id))
                }
              />
            )}
            <MusicPlaylistTracks
              playlist={current}
              available={playlists.filter((item) =>
                catalog.selected.includes(item.id)
              )}
              mode={mode}
              editing={editing}
              onOpenEnding={openRelatedPlaylist}
            />
          </div>
        </>
      )}
    </dialog>
  );
}
