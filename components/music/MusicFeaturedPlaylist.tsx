import SiteLink from '@/components/link/SiteLink';

import { isPlainClick } from '@/lib/dom/click';
import { type PlaylistView, listeningTime } from '@/lib/music/presentation';
import type { MusicTrack } from '@/lib/music/types';

import MusicCover from './MusicCover';
import type { MusicSeriesPreview } from './music-gallery';

interface FeaturedPlaylistProps {
  href: (id: string) => string;
  playlist: PlaylistView;
  note: string | undefined;
  memberships: MusicSeriesPreview[];
  openPlaylist: (id: string, source?: HTMLElement) => void;
}

export default function MusicFeaturedPlaylist({
  playlist,
  href,
  note,
  memberships,
  openPlaylist,
}: FeaturedPlaylistProps) {
  const sampleTracks = playlist.tracks;
  const runtime = listeningTime(sampleTracks);
  return (
    <div className="music-feature-details">
      <div className="music-card-caption">
        <h3>{playlist.title}</h3>
      </div>
      <p className="music-small music-feature-meta">
        {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
        {runtime && ` · ${runtime}`}
      </p>
      {note ? (
        <p className="music-card-note">{note}</p>
      ) : (
        <OpeningTracks tracks={sampleTracks} />
      )}
      {memberships.map((item) => (
        <SeriesPreview
          key={item.id}
          series={item}
          href={href}
          openPlaylist={openPlaylist}
        />
      ))}
      <SiteLink
        href={href(playlist.id)}
        preview={false}
        prefetch={false}
        className="site-control music-button music-tonal music-feature-action"
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          openPlaylist(playlist.id, event.currentTarget);
        }}
      >
        Open playlist
      </SiteLink>
    </div>
  );
}

interface OpeningTracksProps {
  tracks: MusicTrack[];
}

function OpeningTracks({ tracks }: OpeningTracksProps) {
  return (
    <ol className="music-feature-tracks" aria-label="Opening tracks">
      {tracks.slice(0, 3).map((track, index) => (
        <li
          key={index}
          className={track.unavailable ? 'music-track-unavailable' : undefined}
        >
          <span className="music-feature-track-number">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="music-feature-track-info">
            <span>{track.title}</span>
            <span>{track.artist}</span>
          </span>
          <span className="music-feature-track-duration">{track.duration}</span>
        </li>
      ))}
    </ol>
  );
}
interface SeriesPreviewProps {
  href: (id: string) => string;
  series: MusicSeriesPreview;
  openPlaylist: (id: string, source?: HTMLElement) => void;
}
function SeriesPreview({ series, href, openPlaylist }: SeriesPreviewProps) {
  return (
    <div className="music-feature-series">
      <p className="music-feature-series-context">
        <span title={series.title}>{series.title}</span>
        <span>
          Part {series.position} of {series.total}
        </span>
      </p>
      <div
        className="music-feature-series-covers"
        role="group"
        aria-label={`Other playlists in ${series.title}`}
      >
        {series.related.map((related) => {
          return (
            <SiteLink
              href={href(related.id)}
              preview={false}
              prefetch={false}
              className="music-series-cover"
              key={related.id}
              data-playlist-origin={related.id}
              aria-label={`Open ${related.title} from ${series.title}`}
              title={related.title}
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                openPlaylist(related.id, event.currentTarget);
              }}
            >
              <span className="music-series-cover-frame" data-card-surface="">
                <span data-card-cover="">
                  <MusicCover playlist={related} />
                </span>
              </span>
            </SiteLink>
          );
        })}
      </div>
    </div>
  );
}
