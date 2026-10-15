'use client';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';

import type { MusicTrack } from '@/lib/music/types';

import './playlist-credits.css';
import { usePlaylistCredits } from './usePlaylistCredits';

interface PlaylistCreditsProps {
  tracks: MusicTrack[];
}

/** Native liner notes first; scrolling is an optional, interruptible enhancement. */
export default function PlaylistCredits({ tracks }: PlaylistCreditsProps) {
  const {
    reader,
    enhanced,
    reduced,
    playing,
    running,
    onToggle,
    togglePlayback,
    pause,
  } = usePlaylistCredits();

  return (
    <details
      className="mp-credits"
      data-running={running || undefined}
      onToggle={onToggle}
    >
      <summary>
        Roll credits
        <Icon name="chevron-down" size={16} />
      </summary>
      <div className="mp-credits-controls">
        <p>Scroll to read the credits.</p>
        {enhanced && !reduced && (
          <Button
            variant="quiet"
            aria-label={playing ? 'Pause credits' : 'Resume credits'}
            onClick={togglePlayback}
          >
            {playing ? 'Pause' : 'Roll'}
          </Button>
        )}
      </div>
      <div
        ref={reader}
        className="mp-credits-reader scroller"
        role="region"
        aria-label="Film credits, original track order"
        tabIndex={0}
        onWheel={pause}
        onTouchStart={pause}
        onPointerDown={pause}
        onKeyDown={pause}
        onFocus={pause}
      >
        <div className="mp-credits-intro">
          <p>Closing music</p>
          <h3>A soundtrack for the ending.</h3>
        </div>
        <ol role="list">
          {tracks.map((track, index) => (
            <li key={index}>
              <span className="mp-credits-song">{track.title}</span>
              <span className="mp-credits-artist">
                {track.artist || 'Artist unavailable'}
              </span>
            </li>
          ))}
        </ol>
        <div className="mp-credits-finale">
          <p>Music supervision</p>
          <h3>Willie Chalmers III</h3>
          <p>The end.</p>
        </div>
      </div>
    </details>
  );
}
