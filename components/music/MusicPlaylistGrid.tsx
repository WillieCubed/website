import type { ReactNode, RefObject } from 'react';

import MusicCard from './MusicCard';
import MusicScrollCue from './MusicScrollCue';
import type { MusicGalleryItem } from './music-gallery';

export interface MusicPlaylistGridControls {
  controls?: (item: MusicGalleryItem) => ReactNode;
  pendingControl?: ReactNode;
  onDragStart?: (id: string) => void;
  onDrop?: (id: string) => void;
}
interface Props extends MusicPlaylistGridControls {
  items: MusicGalleryItem[];
  editing: boolean;
  loading: boolean;
  playlistCount: number;
  href: (id: string) => string;
  collectionKey: string;
  gallery: RefObject<HTMLDivElement | null>;
  openPlaylist: (id: string, source?: HTMLElement) => void;
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
  controls,
  pendingControl,
}: Props) {
  return (
    <>
      <div
        ref={gallery}
        className={`music-grid${editing ? ' music-grid-editing' : ''}`}
      >
        {loading && playlistCount === 0 ? (
          <MusicPendingCards control={pendingControl} />
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
              controls={controls?.(item)}
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
  control?: ReactNode;
}

function MusicPendingCards({ control }: MusicPendingCardsProps) {
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
      {control}
    </article>
  ));
}
