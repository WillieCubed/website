'use client';
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
    <div className="mp-card-controls">
      <label
        className="mp-check"
        title={!playlist.eligible ? 'Unavailable for publication' : undefined}
      >
        <MusicSelectionControl
          checked={selected}
          disabled={controls.selectionDisabled}
          onChange={() => select(playlist.id)}
          aria-label={`Include ${playlist.title}${!playlist.eligible ? ', unavailable for publication' : ''}`}
        />
        {!playlist.eligible ? 'Unavailable' : selected ? 'Included' : 'Include'}
      </label>
      <div className="mp-order-buttons" hidden={controls.reorderHidden}>
        <span className="mp-order-label">Order</span>
        <button
          className="mp-icon-button"
          disabled={controls.earlierDisabled}
          onClick={() => reorder(playlist.id, -1)}
          aria-label={`Move ${playlist.title} earlier`}
        >
          <Icon name="arrow-left" />
        </button>
        <button
          className="mp-icon-button"
          disabled={controls.laterDisabled}
          onClick={() => reorder(playlist.id, 1)}
          aria-label={`Move ${playlist.title} later`}
        >
          <Icon name="arrow-right" />
        </button>
      </div>
    </div>
  );
}
