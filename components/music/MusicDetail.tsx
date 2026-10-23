import type { ReactNode } from 'react';

import Modal from '@/components/site/Modal';

import {
  type MusicMode,
  type PlaylistView,
  listeningTime,
} from '@/lib/music/presentation';

import MusicDetailNavigation from './MusicDetailNavigation';
import type { MusicCollectionView } from './MusicExperienceView';
import {
  MusicPlaylistArtwork,
  MusicPlaylistSummary,
  MusicPlaylistTracks,
} from './MusicPlaylistDetails';
import { detailDialogKeyDown } from './music-dialog';
import './styles/detail.css';

export interface MusicDetailSlots {
  editor?: (playlist: PlaylistView) => ReactNode;
  seriesContext?: (playlist: PlaylistView) => ReactNode;
}
type MusicDetailView = Pick<
  MusicCollectionView,
  'catalog' | 'playlists' | 'browsing' | 'initialDetail'
>;
interface Props extends MusicDetailSlots {
  collection: MusicDetailView;
  mode: MusicMode;
  editing: boolean;
}
export default function MusicDetail({
  collection,
  mode,
  editing,
  editor,
  seriesContext,
}: Props) {
  const { catalog, playlists, browsing, initialDetail } = collection;
  const { navigation, selection, seriesId, reordering } = browsing;
  const {
    focused,
    dialog,
    currentIndex,
    focusIds,
    openPlaylist,
    closePlaylist,
    openRelatedPlaylist,
  } = navigation;
  const current = playlists.find((playlist) => playlist.id === focused);
  return (
    <Modal
      ref={dialog}
      initiallyOpen={Boolean(initialDetail) && focused === initialDetail}
      className="music-detail site-scrim"
      data-editing={editing || undefined}
      data-reordering={(editing && reordering) || undefined}
      aria-labelledby="music-detail-title"
      onKeyDown={(event) => detailDialogKeyDown(event, dialog.current)}
      onDismiss={closePlaylist}
    >
      {current && (
        <>
          <MusicDetailNavigation
            index={currentIndex}
            ids={focusIds}
            series={selection.series}
            onOpen={openPlaylist}
            onClose={closePlaylist}
            closeHref={navigation.href(seriesId, null)}
            title={current.title}
            playlistId={current.id}
            dialog={dialog}
          />
          <div
            className="music-detail-scroll scroller"
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
              context={seriesContext?.(current)}
            />
            {editor?.(current)}
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
    </Modal>
  );
}
