import {
  toggleCatalogFeature,
  toggleCatalogMembership,
  toggleCatalogSelection,
  updateCatalogNote,
} from '@/lib/music/catalog-edits';
import type { Catalog } from '@/lib/music/presentation';

import type { MusicDetailSlots } from './MusicDetail';
import MusicPlaylistSeriesEditor from './MusicPlaylistSeriesEditor';
import MusicSelectionControl from './MusicSelectionControl';

interface EditorProps {
  note: string;
  selected: boolean;
  featured: boolean;
  onUpdateNote: (note: string) => void;
  onToggleSelection: () => void;
  onToggleFeature: () => void;
}
export default function MusicPlaylistEditor({
  note,
  selected,
  featured,
  onUpdateNote,
  onToggleSelection,
  onToggleFeature,
}: EditorProps) {
  return (
    <div className="music-context-editor">
      <div className="music-context-note">
        <label htmlFor="music-playlist-note">Playlist notes</label>
        <textarea
          id="music-playlist-note"
          rows={3}
          placeholder="What should someone know before listening?"
          value={note}
          onChange={(event) => onUpdateNote(event.target.value)}
        />
      </div>
      <fieldset className="music-visibility-editor">
        <legend>In the public gallery</legend>
        <label className="music-check">
          <MusicSelectionControl
            aria-label="Include in gallery"
            checked={selected}
            onChange={() => onToggleSelection()}
          />
          Include in gallery
        </label>
        <label className="music-check">
          <MusicSelectionControl
            checked={featured}
            onChange={onToggleFeature}
          />
          Feature in the gallery
        </label>
      </fieldset>
    </div>
  );
}

export function musicPlaylistCuration(
  draft: Catalog,
  onChange: (catalog: Catalog) => void
): MusicDetailSlots {
  return {
    editor: (playlist) => (
      <MusicPlaylistEditor
        note={draft.notes[playlist.id] ?? ''}
        selected={draft.selected.includes(playlist.id)}
        featured={draft.lead === playlist.id}
        onUpdateNote={(note) =>
          onChange(updateCatalogNote(draft, playlist.id, note))
        }
        onToggleSelection={() =>
          onChange(toggleCatalogSelection(draft, playlist.id))
        }
        onToggleFeature={() =>
          onChange(toggleCatalogFeature(draft, playlist.id))
        }
      />
    ),
    seriesContext: (playlist) => (
      <MusicPlaylistSeriesEditor
        playlistId={playlist.id}
        series={draft.series}
        onToggleMembership={(id) =>
          onChange(toggleCatalogMembership(draft, id, playlist.id))
        }
      />
    ),
  };
}
