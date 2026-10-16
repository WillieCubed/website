import type { MusicSeries } from '@/lib/music/types';

import MusicSelectionControl from './MusicSelectionControl';

interface Props {
  playlistId: string;
  series: MusicSeries[];
  editing: boolean;
  onToggleMembership: (id: string) => void;
}
export default function MusicPlaylistSeries({
  playlistId,
  series,
  editing,
  onToggleMembership,
}: Props) {
  if (editing && series.length > 0)
    return (
      <fieldset className="mp-detail-series-editor">
        <legend className="mp-detail-series-label">Series</legend>
        {series.map((item) => {
          const index = item.playlistIds.indexOf(playlistId);
          return (
            <label className="mp-detail-series mp-check" key={item.id}>
              <MusicSelectionControl
                aria-label={item.title}
                checked={index >= 0}
                onChange={() => onToggleMembership(item.id)}
              />
              <span className="mp-detail-series-name">{item.title}</span>
              {index >= 0 && (
                <SeriesPosition
                  position={index + 1}
                  count={item.playlistIds.length}
                />
              )}
            </label>
          );
        })}
      </fieldset>
    );
  return series
    .filter((item) => item.playlistIds.includes(playlistId))
    .map((item) => (
      <p key={item.id} className="mp-detail-series">
        <span className="mp-detail-series-label">Series</span>
        <span className="mp-detail-series-name">{item.title}</span>
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
function SeriesPosition({ position, count }: SeriesPositionProps) {
  return (
    <span className="mp-detail-series-position">
      <span aria-hidden="true">{`${String(position).padStart(2, '0')} / ${String(count).padStart(2, '0')}`}</span>
      <span className="sr-only">
        Playlist {position} of {count}
      </span>
    </span>
  );
}
