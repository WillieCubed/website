'use client';
import type { ComponentType, RefObject } from 'react';

import type { DialogBackdropHandlers } from '@/components/site/useBackdropDismiss';

import {
  type Catalog,
  type MusicMode,
  type PlaylistView,
  listeningTime,
} from '@/lib/music/presentation';
import type { MusicSeries } from '@/lib/music/types';

import MusicCover from './MusicCover';
import {
  MusicDetailNavigation,
  MusicPlaylistArtwork,
  MusicPlaylistEditor,
  MusicPlaylistSummary,
  MusicPlaylistTracks,
} from './MusicPlaylistDetails';
import { detailDialogKeyDown } from './music-dialog';

interface PlaylistDetailsContext {
  mode: MusicMode;
  editing: boolean;
  catalog: Catalog;
  draft: Catalog;
  updateNote: (id: string, note: string) => void;
  toggleFeature: (id: string) => void;
  select: (id: string) => void;
  membership: (id: string, member: string) => void;
  currentIndex: number;
  focusIds: string[];
  series: MusicSeries | undefined;
  openPlaylist: (id: string, source?: HTMLElement) => void;
  closePlaylist: () => void;
}
interface Props extends PlaylistDetailsContext {
  initialDetail?: string;
  focused: string | null;
  reordering: boolean;
  closeHref: string;
  current: PlaylistView | undefined;
  dialog: RefObject<HTMLDialogElement | null>;
  Cover?: ComponentType<{ playlist: PlaylistView }>;
  backdrop: DialogBackdropHandlers;
}
export default function MusicDetail({
  current,
  initialDetail,
  focused,
  reordering,
  closeHref,
  dialog,
  backdrop,
  editing,
  Cover = MusicCover,
  mode,
  catalog,
  draft,
  updateNote,
  toggleFeature,
  select,
  membership,
  currentIndex,
  focusIds,
  series,
  openPlaylist,
  closePlaylist,
}: Props) {
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
          />
          <div
            className="mp-detail-scroll scroller"
            role="region"
            aria-label="Playlist details"
            tabIndex={-1}
          >
            <MusicPlaylistArtwork
              playlist={current}
              Cover={Cover}
              series={catalog.series}
            />
            <MusicPlaylistSummary
              playlist={current}
              runtime={listeningTime(current.tracks)}
              mode={mode}
              note={editing ? undefined : catalog.notes[current.id]}
            />
            {editing && (
              <MusicPlaylistEditor
                playlistId={current.id}
                draft={draft}
                onUpdateNote={(note) => updateNote(current.id, note)}
                onToggleSelection={() => select(current.id)}
                onToggleFeature={() => toggleFeature(current.id)}
                onToggleMembership={(id) => membership(id, current.id)}
              />
            )}
            <MusicPlaylistTracks
              tracks={current.tracks}
              playlistId={current.id}
              editing={editing}
            />
          </div>
        </>
      )}
    </dialog>
  );
}
