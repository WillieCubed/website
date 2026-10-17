import SiteLink from '@/components/link/SiteLink';

import { isPlainClick } from '@/lib/dom/click';
import type { MusicSeries } from '@/lib/music/types';

interface Props {
  series: MusicSeries[];
  selected: string[];
  currentSeriesId: string | undefined;
  editing: boolean;
  loading: boolean;
  playlistCount: number;
  href: (series: string | null, detail: string | null) => string;
  chooseSeries: (id: string | null) => void;
}
export default function MusicSeriesNavigation({
  series,
  selected,
  currentSeriesId,
  editing,
  loading,
  playlistCount,
  href,
  chooseSeries,
}: Props) {
  return (
    <nav
      className="mp-series-nav"
      aria-label="Playlist series"
      inert={loading || undefined}
      aria-disabled={loading || undefined}
    >
      <SiteLink
        href={href(null, null)}
        preview={false}
        prefetch={false}
        aria-current={!currentSeriesId ? 'page' : undefined}
        data-selected={!currentSeriesId || undefined}
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          chooseSeries(null);
        }}
      >
        <span>All playlists</span>
        <span>
          {loading ? (
            <span className="mp-pending-count" />
          ) : editing ? (
            playlistCount
          ) : (
            selected.length
          )}
        </span>
      </SiteLink>
      {series.map((item) => (
        <SiteLink
          href={href(item.id, null)}
          preview={false}
          prefetch={false}
          key={item.id}
          aria-current={currentSeriesId === item.id ? 'page' : undefined}
          data-selected={currentSeriesId === item.id || undefined}
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            chooseSeries(item.id);
          }}
        >
          <span>{item.title}</span>
          <span>
            {
              item.playlistIds.filter((id) => editing || selected.includes(id))
                .length
            }
          </span>
        </SiteLink>
      ))}
    </nav>
  );
}
