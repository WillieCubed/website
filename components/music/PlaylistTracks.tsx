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
      <span className="mp-track-copy">
        <span className="mp-track-title">{track.title}</span>
        {track.artist && (
          <span className="mp-track-artist">{track.artist}</span>
        )}
        {status && <span className="mp-track-status">{status}</span>}
      </span>
      <span className="mp-track-trailing">
        <span className="mp-track-metadata">
          <span className="mp-track-number" aria-hidden="true">
            #{String(index + 1).padStart(2, '0')}
          </span>
          <span className="mp-track-duration">{track.duration}</span>
        </span>
        {destination && <Icon name="external" size={14} />}
      </span>
    </>
  );
  return (
    <li value={index + 1}>
      {destination ? (
        <a
          className="mp-track-row"
          href={destination}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${track.title}${track.artist ? ` by ${track.artist}` : ''} in Spotify (opens in a new tab)`}
        >
          {content}
        </a>
      ) : (
        <div className="mp-track-row">{content}</div>
      )}
    </li>
  );
}

/** Readable songs and native provider links, in the playlist's original order. */
export default function PlaylistTracks({ tracks }: Props) {
  return (
    <>
      <div className="mp-track-heading">
        <h3 id="mp-track-list-heading">Track list</h3>
      </div>
      <ol
        id="mp-track-list"
        className="mp-track-list"
        role="list"
        aria-labelledby="mp-track-list-heading"
      >
        {tracks.map((track, index) => (
          <TrackRow key={index} track={track} index={index} />
        ))}
      </ol>
      {tracks.length === 0 && (
        <p className="mp-track-empty">No tracks to display.</p>
      )}
    </>
  );
}
