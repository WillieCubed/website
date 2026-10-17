import type { RefObject } from 'react';

import { type PlaylistView, listeningTime } from '@/lib/music/presentation';

import MusicCover from './MusicCover';
import MusicSelectionControl from './MusicSelectionControl';

interface MusicSetupPreviewProps {
  title: RefObject<HTMLHeadingElement | null>;
  collection: PlaylistView[];
  featured?: PlaylistView;
  lead: string | null;
  setLead: (id: string | null) => void;
}

export default function MusicSetupPreview({
  title,
  collection,
  featured,
  lead,
  setLead,
}: MusicSetupPreviewProps) {
  return (
    <section aria-labelledby="ms-title">
      <h1 id="ms-title" ref={title} tabIndex={-1}>
        Give it your shape.
      </h1>
      <p className="ms-intro">
        Put one playlist up front, or give them equal space. Order, notes, and
        series come next.
      </p>
      <div className="ms-preview-layout">
        <div className="ms-gallery-preview" aria-label="Collection preview">
          <h2>Music</h2>
          {featured ? (
            <div className="ms-feature-preview">
              <MusicCover playlist={featured} />
              <div>
                <h3>{featured.title}</h3>
                <p>
                  {featured.trackCount} tracks ·{' '}
                  {listeningTime(featured.tracks)}
                </p>
              </div>
            </div>
          ) : null}
          <div className="ms-preview-grid">
            {collection
              .filter((playlist) => playlist.id !== lead)
              .map((playlist) => (
                <div key={playlist.id}>
                  <MusicCover playlist={playlist} />
                  <h3>{playlist.title}</h3>
                </div>
              ))}
          </div>
          <p className="ms-preview-caption">
            Your collection · {collection.length}{' '}
            {collection.length === 1 ? 'playlist' : 'playlists'}
          </p>
        </div>
        <fieldset className="ms-feature-options">
          <legend>Featured playlist</legend>
          <p>Choose one playlist, or give them equal space.</p>
          <label
            className="ms-feature-option ms-feature-none"
            data-selected={!lead || undefined}
          >
            <span className="ms-feature-option-copy">No featured playlist</span>
            <MusicSelectionControl
              type="radio"
              name="setup-feature"
              aria-label="No featured playlist"
              indicator="equal"
              checked={!lead}
              onChange={() => setLead(null)}
            />
          </label>
          <div className="ms-feature-playlists">
            {collection.map((playlist) => (
              <label
                className="ms-feature-option"
                key={playlist.id}
                data-selected={lead === playlist.id || undefined}
              >
                <MusicCover playlist={playlist} />
                <span className="ms-feature-option-copy">{playlist.title}</span>
                <MusicSelectionControl
                  type="radio"
                  name="setup-feature"
                  aria-label={`Feature ${playlist.title}`}
                  indicator="feature"
                  checked={lead === playlist.id}
                  onChange={() => setLead(playlist.id)}
                />
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
}
