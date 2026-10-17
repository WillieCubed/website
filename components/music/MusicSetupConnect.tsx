import type { RefObject } from 'react';

import Icon from '@/components/icons/Icon';
import SpotifyIcon from '@/components/icons/SpotifyIcon';

import { type PlaylistView } from '@/lib/music/presentation';

import MusicCover from './MusicCover';

interface MusicSetupConnectProps {
  title: RefObject<HTMLHeadingElement | null>;
  playlists: PlaylistView[];
  onConnect: () => void;
}
export default function MusicSetupConnect({
  title,
  playlists,
  onConnect,
}: MusicSetupConnectProps) {
  return (
    <section className="ms-connect" aria-labelledby="ms-title">
      <div className="ms-connect-copy">
        <h1 id="ms-title" ref={title} tabIndex={-1}>
          Your playlists.
          <br />
          Your call.
        </h1>
        <p className="ms-intro">
          Bring your Spotify playlists here. Choose what belongs, give your
          favorites room, and keep every track in its place.
        </p>
        <button
          className="site-control ms-button music-primary ms-connect-button"
          data-control-size="medium"
          onClick={onConnect}
        >
          <SpotifyIcon />
          Connect Spotify
          <Icon name="arrow-right" />
        </button>
        <p className="ms-permission">
          Read your playlists. Never change them.
          <br />
          You choose what goes in the gallery.
        </p>
      </div>
      <div className="ms-cover-arrangement" aria-hidden="true">
        <div className="ms-art ms-art-back">
          {playlists[4] != null ? (
            <MusicCover playlist={playlists[4]} />
          ) : (
            <SpotifyIcon />
          )}
        </div>
        <div className="ms-art ms-art-middle">
          {playlists[1] != null ? (
            <MusicCover playlist={playlists[1]} />
          ) : (
            <Icon name="music" />
          )}
        </div>
        <div className="ms-art ms-art-front">
          {playlists[0] != null ? (
            <MusicCover playlist={playlists[0]} />
          ) : (
            <Icon name="music" />
          )}
        </div>
      </div>
      <div className="ms-connect-details">
        <div>
          <Icon name="check" />
          <p>
            Include a few favorites.
            <span>The rest can stay on Spotify.</span>
          </p>
        </div>
        <div>
          <Icon name="music" />
          <p>
            Keep the sequence.
            <span>Track order stays exactly as you made it.</span>
          </p>
        </div>
        <div>
          <Icon name="file" />
          <p>
            Make room for a series.
            <span>Group and order playlists during curation.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
