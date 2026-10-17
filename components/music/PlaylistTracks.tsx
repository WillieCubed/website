import Icon from '@/components/icons/Icon';

import type { MusicTrack } from '@/lib/music/types';

interface TrackRowProps {
  track: MusicTrack;
  index: number;
}
interface Props {
  tracks: MusicTrack[];
}

function TrackRow({ track, index }: TrackRowProps) {
  const status =
    track.kind === 'local'
      ? 'Local file'
      : track.unavailable || track.kind === 'unavailable'
        ? 'Unavailable'
        : null;
  const destination = status ? null : track.url;
  const content = (
    <>
      <span className="music-track-copy">
        <span className="music-track-title">{track.title}</span>
        {track.artist && (
          <span className="music-track-artist">{track.artist}</span>
        )}
        {status && <span className="music-track-status">{status}</span>}
      </span>
      <span className="music-track-trailing">
        <span className="music-track-metadata">
          <span className="music-track-number" aria-hidden="true">
            #{String(index + 1).padStart(2, '0')}
          </span>
          <span className="music-track-duration">{track.duration}</span>
        </span>
        {destination && <Icon name="external" size={14} />}
      </span>
    </>
  );
  return (
    <li value={index + 1}>
      {destination ? (
        <a
          className="music-track-row"
          href={destination}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${track.title}${track.artist ? ` by ${track.artist}` : ''} in Spotify (opens in a new tab)`}
        >
          {content}
        </a>
      ) : (
        <div className="music-track-row">{content}</div>
      )}
    </li>
  );
}

/** Readable songs and native provider links, in the playlist's original order. */
export default function PlaylistTracks({ tracks }: Props) {
  return (
    <>
      <div className="music-track-heading">
        <h3 id="music-track-list-heading">Track list</h3>
      </div>
      <ol
        id="music-track-list"
        className="music-track-list"
        role="list"
        aria-labelledby="music-track-list-heading"
      >
        {tracks.map((track, index) => (
          <TrackRow key={index} track={track} index={index} />
        ))}
      </ol>
      {tracks.length === 0 && (
        <p className="music-track-empty">No tracks to display.</p>
      )}
    </>
  );
}
