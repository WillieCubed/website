'use client';
import type { ComponentType } from 'react';

import SiteLink from '@/components/link/SiteLink';

import { isPlainClick } from '@/lib/dom/click';
import { type PlaylistView, listeningTime } from '@/lib/music/presentation';
import type { MusicTrack } from '@/lib/music/types';

import type { MusicCoverProps } from './MusicCover';
import type { MusicSeriesPreview } from './music-gallery';

interface FeaturedPlaylistProps {
  href: (id: string) => string;
  playlist: PlaylistView;
  note: string | undefined;
  memberships: MusicSeriesPreview[];
  Cover: ComponentType<MusicCoverProps>;
  openPlaylist: (id: string, source?: HTMLElement) => void;
}

export default function MusicFeaturedPlaylist({
  playlist,
  href,
  note,
  memberships,
  Cover,
  openPlaylist,
}: FeaturedPlaylistProps) {
  const sampleTracks = playlist.tracks;
  const runtime = listeningTime(sampleTracks);
  return (
    <div className="mp-feature-details">
      <div className="mp-card-caption">
        <h3>{playlist.title}</h3>
      </div>
      <p className="mp-small mp-feature-meta">
        {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
        {runtime && ` · ${runtime}`}
      </p>
      {note ? (
        <p className="mp-card-note">{note}</p>
      ) : (
        <OpeningTracks tracks={sampleTracks} />
      )}
      {memberships.map((item) => (
        <SeriesPreview
          key={item.id}
          series={item}
          href={href}
          Cover={Cover}
          openPlaylist={openPlaylist}
        />
      ))}
      <SiteLink
        href={href(playlist.id)}
        preview={false}
        prefetch={false}
        className="mp-button mp-tonal mp-feature-action"
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
    <ol className="mp-feature-tracks" aria-label="Opening tracks">
      {tracks.slice(0, 3).map((track, index) => (
        <li
          key={index}
          className={track.unavailable ? 'mp-track-unavailable' : undefined}
        >
          <span className="mp-feature-track-number">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="mp-feature-track-info">
            <span>{track.title}</span>
            <span>{track.artist}</span>
          </span>
          <span className="mp-feature-track-duration">{track.duration}</span>
        </li>
      ))}
    </ol>
  );
}
interface SeriesPreviewProps {
  href: (id: string) => string;
  series: MusicSeriesPreview;
  Cover: ComponentType<MusicCoverProps>;
  openPlaylist: (id: string, source?: HTMLElement) => void;
}
function SeriesPreview({
  series,
  href,
  Cover,
  openPlaylist,
}: SeriesPreviewProps) {
  return (
    <div className="mp-feature-series">
      <p className="mp-feature-series-context">
        <span title={series.title}>{series.title}</span>
        <span>
          Part {series.position} of {series.total}
        </span>
      </p>
      <div
        className="mp-feature-series-covers"
        role="group"
        aria-label={`Other playlists in ${series.title}`}
      >
        {series.related.map((related) => {
          return (
            <SiteLink
              href={href(related.id)}
              preview={false}
              prefetch={false}
              className="mp-series-cover"
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
              <span className="mp-series-cover-frame" data-card-surface="">
                <span data-card-cover="">
                  <Cover playlist={related} />
                </span>
              </span>
            </SiteLink>
          );
        })}
      </div>
    </div>
  );
}
