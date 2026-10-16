'use client';
import type { ComponentType } from 'react';

import Icon from '@/components/icons/Icon';
import SpotifyIcon from '@/components/icons/SpotifyIcon';

import { offersCredits, playlistEnding } from '@/lib/music/easter-eggs';
import type {
  Catalog,
  MusicMode,
  PlaylistView,
} from '@/lib/music/presentation';
import type { MusicSeries } from '@/lib/music/types';

import type { MusicCoverProps } from './MusicCover';
import MusicPlaylistSeries from './MusicPlaylistSeries';
import MusicSelectionControl from './MusicSelectionControl';
import PlaylistCredits from './PlaylistCredits';
import PlaylistEnding from './PlaylistEnding';
import PlaylistTracks from './PlaylistTracks';
import { musicHref } from './useMusicPlaylistHistory';

interface ArtworkProps {
  playlist: PlaylistView;
  Cover: ComponentType<MusicCoverProps>;
  series: MusicSeries[];
  editing: boolean;
  onToggleMembership: (id: string) => void;
}
export function MusicPlaylistArtwork({
  playlist,
  Cover,
  series,
  editing,
  onToggleMembership,
}: ArtworkProps) {
  return (
    <div className="mp-detail-art-column">
      <div className="mp-detail-art" data-focus-cover="">
        <Cover playlist={playlist} />
      </div>
      <div className="mp-detail-context">
        <MusicPlaylistSeries
          playlistId={playlist.id}
          series={series}
          editing={editing}
          onToggleMembership={onToggleMembership}
        />
      </div>
    </div>
  );
}
interface SummaryProps {
  playlist: PlaylistView;
  runtime: string | null;
  mode: MusicMode;
  note: string | undefined;
}
export function MusicPlaylistSummary({
  playlist,
  runtime,
  mode,
  note,
}: SummaryProps) {
  return (
    <div className="mp-detail-body">
      <h2 id="mp-detail-title" tabIndex={-1} aria-live="polite">
        {playlist.title}
      </h2>

      <div className="mp-detail-summary">
        <p className="mp-detail-meta">
          {playlist.trackCount} items{runtime && ` · ${runtime}`}
          {mode === 'prototype' && ' · Sample sequence'}
        </p>
        {mode === 'prototype' ? (
          <>
            <button className="mp-button mp-spotify" disabled>
              Open in Spotify
              <Icon name="external" />
            </button>
            <p className="mp-spotify-note">Sample playlist · No Spotify link</p>
          </>
        ) : (
          <a
            className="mp-button mp-spotify"
            href={playlist.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <SpotifyIcon />
            Open in Spotify
            <Icon name="external" />
          </a>
        )}
      </div>
      {note && <p className="mp-playlist-note">{note}</p>}
    </div>
  );
}
interface EditorProps {
  playlistId: string;
  draft: Catalog;
  onUpdateNote: (note: string) => void;
  onToggleSelection: () => void;
  onToggleFeature: () => void;
}
export function MusicPlaylistEditor({
  playlistId,
  draft,
  onUpdateNote,
  onToggleSelection,
  onToggleFeature,
}: EditorProps) {
  return (
    <div className="mp-context-editor">
      <div className="mp-context-note">
        <label htmlFor="mp-playlist-note">Playlist notes</label>
        <textarea
          id="mp-playlist-note"
          rows={3}
          placeholder="What should someone know before listening?"
          value={draft.notes[playlistId] ?? ''}
          onChange={(event) => onUpdateNote(event.target.value)}
        />
      </div>
      <fieldset className="mp-visibility-editor">
        <legend>In the public gallery</legend>
        <label className="mp-check">
          <MusicSelectionControl
            aria-label="Include in gallery"
            checked={draft.selected.includes(playlistId)}
            onChange={() => onToggleSelection()}
          />
          Include in gallery
        </label>
        <label className="mp-check">
          <MusicSelectionControl
            checked={draft.lead === playlistId}
            onChange={onToggleFeature}
          />
          Feature in the gallery
        </label>
      </fieldset>
    </div>
  );
}
interface MusicPlaylistTracksProps {
  playlist: PlaylistView;
  available: PlaylistView[];
  mode: MusicMode;
  editing: boolean;
  onOpenEnding: (id: string) => void;
}
export function MusicPlaylistTracks({
  playlist,
  available,
  mode,
  editing,
  onOpenEnding,
}: MusicPlaylistTracksProps) {
  const ending = editing ? null : playlistEnding(playlist, available);
  return (
    <div className="mp-detail-tracks">
      {!editing && offersCredits(playlist.id) && playlist.tracks.length > 0 && (
        <PlaylistCredits key={playlist.id} tracks={playlist.tracks} />
      )}
      <PlaylistTracks key={playlist.id} tracks={playlist.tracks} />
      {ending && (
        <PlaylistEnding
          ending={ending}
          href={ending.link ? musicHref(null, ending.link.id, mode) : undefined}
          onOpen={onOpenEnding}
        />
      )}
    </div>
  );
}
