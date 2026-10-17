import Icon from '@/components/icons/Icon';

import type { PlaylistView } from '@/lib/music/presentation';

import MusicSelectionControl from './MusicSelectionControl';
import type { MusicCardCuration } from './music-gallery';

interface PlaylistControlsProps {
  playlist: PlaylistView;
  selected: boolean;
  controls: MusicCardCuration;
  select: (id: string) => void;
  reorder: (id: string, step: number) => void;
}

export default function MusicCardControls({
  playlist,
  selected,
  controls,
  select,
  reorder,
}: PlaylistControlsProps) {
  return (
    <div className="music-card-controls">
      <label
        className="music-check"
        title={!playlist.eligible ? 'Unavailable for publication' : undefined}
      >
        <MusicSelectionControl
          checked={selected}
          data-control-size="small"
          disabled={controls.selectionDisabled}
          onChange={() => select(playlist.id)}
          aria-label={`Include ${playlist.title}${!playlist.eligible ? ', unavailable for publication' : ''}`}
        />
        {!playlist.eligible ? 'Unavailable' : selected ? 'Included' : 'Include'}
      </label>
      <div className="music-order-buttons" hidden={controls.reorderHidden}>
        <span className="music-order-label">Order</span>
        <button
          className="site-control music-icon-button"
          data-control-size="small"
          disabled={controls.earlierDisabled}
          onClick={() => reorder(playlist.id, -1)}
          aria-label={`Move ${playlist.title} earlier`}
        >
          <span className="site-control__surface">
            <Icon name="arrow-left" />
          </span>
        </button>
        <button
          className="site-control music-icon-button"
          data-control-size="small"
          disabled={controls.laterDisabled}
          onClick={() => reorder(playlist.id, 1)}
          aria-label={`Move ${playlist.title} later`}
        >
          <span className="site-control__surface">
            <Icon name="arrow-right" />
          </span>
        </button>
      </div>
    </div>
  );
}
