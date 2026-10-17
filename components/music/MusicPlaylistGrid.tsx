import type { RefObject } from 'react';

import MusicCard from './MusicCard';
import MusicScrollCue from './MusicScrollCue';
import MusicSelectionControl from './MusicSelectionControl';
import type { MusicGalleryItem } from './music-gallery';

interface Props {
  items: MusicGalleryItem[];
  editing: boolean;
  loading: boolean;
  playlistCount: number;
  href: (id: string) => string;
  collectionKey: string;
  gallery: RefObject<HTMLDivElement | null>;
  onDragStart: (id: string) => void;
  onDrop: (id: string) => void;
  openPlaylist: (id: string, source?: HTMLElement) => void;
  select: (id: string) => void;
  reorder: (id: string, step: number) => void;
}
export default function MusicPlaylistGrid({
  items,
  editing,
  loading,
  playlistCount,
  href,
  collectionKey,
  gallery,
  onDragStart,
  onDrop,
  openPlaylist,
  select,
  reorder,
}: Props) {
  return (
    <>
      <div
        ref={gallery}
        className={`music-grid${editing ? ' music-grid-editing' : ''}`}
      >
        {loading && playlistCount === 0 ? (
          <MusicPendingCards editing={editing} />
        ) : (
          items.map((item) => (
            <MusicCard
              key={item.playlist.id}
              item={item}
              editing={editing}
              href={href}
              onDragStart={onDragStart}
              onDrop={onDrop}
              openPlaylist={openPlaylist}
              select={select}
              reorder={reorder}
            />
          ))
        )}
      </div>
      {!editing && (
        <MusicScrollCue gallery={gallery} collection={collectionKey} />
      )}
    </>
  );
}

interface MusicPendingCardsProps {
  editing: boolean;
}

function MusicPendingCards({ editing }: MusicPendingCardsProps) {
  return Array.from({ length: 6 }, (_, index) => (
    <article
      className="music-card music-card-pending"
      key={index}
      aria-hidden="true"
    >
      <div className="music-card-open">
        <div className="music-art-frame">
          <div className="music-art" />
        </div>
        <div className="music-card-caption">
          <div>
            <span className="music-pending-line" />
            <p className="music-small">
              <span className="music-pending-line music-pending-line-short" />
            </p>
          </div>
          <span className="music-open-icon" />
        </div>
      </div>
      {editing && (
        <div className="music-card-controls">
          <label className="music-check">
            <MusicSelectionControl disabled tabIndex={-1} />
            <span className="music-pending-line music-pending-control" />
          </label>
        </div>
      )}
    </article>
  ));
}
