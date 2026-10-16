'use client';
import type { ComponentType } from 'react';

import Icon from '@/components/icons/Icon';
import SpotifyIcon from '@/components/icons/SpotifyIcon';
import SiteLink from '@/components/link/SiteLink';

import { isPlainClick } from '@/lib/dom/click';
import { offersCredits } from '@/lib/music/easter-eggs';
import type {
  Catalog,
  MusicMode,
  PlaylistView,
} from '@/lib/music/presentation';
import type { MusicSeries, MusicTrack } from '@/lib/music/types';

import type { MusicCoverProps } from './MusicCover';
import MusicSelectionControl from './MusicSelectionControl';
import PlaylistCredits from './PlaylistCredits';

interface NavigationProps {
  closeHref: string;
  index: number;
  ids: string[];
  series: MusicSeries | undefined;
  onOpen: (id: string) => void;
  onClose: () => void;
}
export function MusicDetailNavigation({
  index,
  ids,
  series,
  onOpen,
  onClose,
  closeHref,
}: NavigationProps) {
  return (
    <div className="mp-detail-bar scroller">
      <span>
        {series
          ? `${series.title} / ${String(index + 1).padStart(2, '0')}`
          : `${index + 1} of ${ids.length}`}
      </span>
      <div className="mp-detail-actions">
        <div
          className="mp-detail-pagination"
          role="group"
          aria-label="Playlist navigation"
        >
          <button
            className="mp-icon-button mp-icon-button--tonal"
            disabled={index <= 0}
            onClick={() => onOpen(ids[index - 1])}
            aria-label="Previous playlist"
          >
            <Icon name="arrow-left" size={24} />
          </button>
          <button
            className="mp-icon-button mp-icon-button--filled"
            disabled={index < 0 || index >= ids.length - 1}
            onClick={() => onOpen(ids[index + 1])}
            aria-label="Next playlist"
          >
            <Icon name="arrow-right" size={24} />
          </button>
        </div>
        <SiteLink
          href={closeHref}
          preview={false}
          className="mp-icon-button mp-icon-button--tonal mp-detail-close"
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            onClose();
          }}
          aria-label="Close playlist"
        >
          <Icon name="x" size={24} />
        </SiteLink>
      </div>
    </div>
  );
}
interface ArtworkProps {
  playlist: PlaylistView;
  Cover: ComponentType<MusicCoverProps>;
  series: MusicSeries[];
}
export function MusicPlaylistArtwork({
  playlist,
  Cover,
  series,
}: ArtworkProps) {
  return (
    <div className="mp-detail-art-column">
      <div className="mp-detail-art" data-focus-cover="">
        <Cover playlist={playlist} />
      </div>
      <div className="mp-detail-context">
        {series
          .filter((item) => item.playlistIds.includes(playlist.id))
          .map((item) => (
            <p key={item.id} className="mp-detail-series">
              <span>{item.title}</span>
              <span>
                {String(item.playlistIds.indexOf(playlist.id) + 1).padStart(
                  2,
                  '0'
                )}{' '}
                / {String(item.playlistIds.length).padStart(2, '0')}
              </span>
            </p>
          ))}
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
      <p className="mp-detail-meta">
        {playlist.trackCount} items{runtime && ` · ${runtime}`}
        {mode === 'prototype' && ' · Sample sequence'}
      </p>
      {note && <p className="mp-playlist-note">{note}</p>}
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
  );
}
interface EditorProps {
  playlistId: string;
  draft: Catalog;
  onUpdateNote: (note: string) => void;
  onToggleSelection: () => void;
  onToggleFeature: () => void;
  onToggleMembership: (seriesId: string) => void;
}
export function MusicPlaylistEditor({
  playlistId,
  draft,
  onUpdateNote,
  onToggleSelection,
  onToggleFeature,
  onToggleMembership,
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
      <fieldset>
        <legend>Series</legend>
        {draft.series.map((item) => (
          <label className="mp-check" key={item.id}>
            <MusicSelectionControl
              checked={item.playlistIds.includes(playlistId)}
              onChange={() => onToggleMembership(item.id)}
            />
            {item.title}
          </label>
        ))}
      </fieldset>
    </div>
  );
}
interface MusicPlaylistTracksProps {
  tracks: MusicTrack[];
  playlistId: string;
  editing: boolean;
}

export function MusicPlaylistTracks({
  tracks: sampleTracks,
  playlistId,
  editing,
}: MusicPlaylistTracksProps) {
  return (
    <div className="mp-detail-tracks">
      {!editing && offersCredits(playlistId) && sampleTracks.length > 0 && (
        <PlaylistCredits key={playlistId} tracks={sampleTracks} />
      )}
      <div className="mp-track-heading">
        <h3>Track list</h3>
        <span>Original order</span>
      </div>
      <ol className="mp-track-list">
        {sampleTracks.map((track, index) => (
          <li
            key={index}
            className={track.unavailable ? 'mp-track-unavailable' : undefined}
          >
            <span className="mp-track-number">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span>
              <span className="mp-track-title">{track.title}</span>
              <span className="mp-track-artist">{track.artist}</span>
            </span>
            <span className="mp-track-duration">{track.duration}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
