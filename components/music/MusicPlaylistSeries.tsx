import type { MusicSeries } from '@/lib/music/types';

interface Props {
  playlistId: string;
  series: MusicSeries[];
}
export default function MusicPlaylistSeries({ playlistId, series }: Props) {
  return series
    .filter((item) => item.playlistIds.includes(playlistId))
    .map((item) => (
      <p key={item.id} className="music-detail-series">
        <span className="music-detail-series-label">Series</span>
        <span className="music-detail-series-name">{item.title}</span>
        <SeriesPosition
          position={item.playlistIds.indexOf(playlistId) + 1}
          count={item.playlistIds.length}
        />
      </p>
    ));
}
interface SeriesPositionProps {
  position: number;
  count: number;
}
export function SeriesPosition({ position, count }: SeriesPositionProps) {
  return (
    <span className="music-detail-series-position">
      <span aria-hidden="true">{`${String(position).padStart(2, '0')} / ${String(count).padStart(2, '0')}`}</span>
      <span className="sr-only">
        Playlist {position} of {count}
      </span>
    </span>
  );
}
