import type { RefObject } from 'react';

import SpotifyIcon from '@/components/icons/SpotifyIcon';

import { type PlaylistView, listeningTime } from '@/lib/music/presentation';

import MusicCover from './MusicCover';
import MusicSelectionControl from './MusicSelectionControl';

interface MusicSetupChooseProps {
  title: RefObject<HTMLHeadingElement | null>;
  playlists: PlaylistView[];
  selected: string[];
  toggle: (id: string) => void;
}

export default function MusicSetupChoose({
  title,
  playlists,
  selected,
  toggle,
}: MusicSetupChooseProps) {
  return (
    <section aria-labelledby="ms-title">
      <div className="ms-selection-heading">
        <div>
          <h1 id="ms-title" ref={title} tabIndex={-1}>
            What belongs here?
          </h1>
          <p className="ms-intro">
            Choose the playlists you want in your collection. You can change
            this later.
          </p>
        </div>
      </div>
      <div className="ms-source">
        <SpotifyIcon />
        <span>Your public Spotify playlists</span>
        <span>{playlists.length} playlists</span>
      </div>
      <fieldset className="ms-playlists">
        <legend className="sr-only">Choose playlists</legend>
        {playlists.map((playlist) => (
          <label
            className="ms-playlist"
            key={playlist.id}
            data-playlist={playlist.id}
            data-selected={selected.includes(playlist.id) || undefined}
          >
            <div className="ms-playlist-art">
              <MusicCover playlist={playlist} />
            </div>
            <span className="ms-playlist-copy">
              <span className="ms-playlist-title">{playlist.title}</span>
              <span className="ms-playlist-meta">
                {playlist.trackCount} tracks · {listeningTime(playlist.tracks)}
              </span>
            </span>
            <MusicSelectionControl
              aria-label={`Select ${playlist.title}`}
              checked={selected.includes(playlist.id)}
              onChange={() => toggle(playlist.id)}
            />
          </label>
        ))}
      </fieldset>
      {playlists.length === 0 && (
        <p className="ms-empty">
          No owned public playlists are available. Make a playlist public on
          Spotify, then refresh your library.
        </p>
      )}
    </section>
  );
}
