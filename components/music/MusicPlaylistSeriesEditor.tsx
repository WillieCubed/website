import type { MusicSeries } from '@/lib/music/types';

import MusicPlaylistSeries, { SeriesPosition } from './MusicPlaylistSeries';
import MusicSelectionControl from './MusicSelectionControl';

interface Props {
  playlistId: string;
  series: MusicSeries[];
  onToggleMembership: (id: string) => void;
}
export default function MusicPlaylistSeriesEditor({
  playlistId,
  series,
  onToggleMembership,
}: Props) {
  return series.length > 0 ? (
    <fieldset className="music-detail-series-editor">
      <legend className="music-detail-series-label">Series</legend>
      {series.map((item) => {
        const index = item.playlistIds.indexOf(playlistId);
        return (
          <label className="music-detail-series music-check" key={item.id}>
            <MusicSelectionControl
              aria-label={item.title}
              checked={index >= 0}
              onChange={() => onToggleMembership(item.id)}
            />
            <span className="music-detail-series-name">{item.title}</span>
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
  ) : (
    <MusicPlaylistSeries playlistId={playlistId} series={series} />
  );
}
