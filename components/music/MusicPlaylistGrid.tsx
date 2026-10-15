'use client';
import type { ComponentType, RefObject } from 'react';

import type { PlaylistView } from '@/lib/music/presentation';

import MusicCard from './MusicCard';
import MusicCover from './MusicCover';
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
  Cover?: ComponentType<{ playlist: PlaylistView }>;
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
  Cover = MusicCover,
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
        className={`mp-grid${editing ? ' mp-grid-editing' : ''}`}
      >
        {loading && playlistCount === 0 ? (
          <MusicPendingCards editing={editing} />
        ) : (
          items.map((item) => (
            <MusicCard
              key={item.playlist.id}
              item={item}
              Cover={Cover}
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

function MusicPendingCards({ editing }: { editing: boolean }) {
  return Array.from({ length: 6 }, (_, index) => (
    <article className="mp-card mp-card-pending" key={index} aria-hidden="true">
      <div className="mp-card-open">
        <div className="mp-art-frame">
          <div className="mp-art" />
        </div>
        <div className="mp-card-caption">
          <div>
            <span className="mp-pending-line" />
            <p className="mp-small">
              <span className="mp-pending-line mp-pending-line-short" />
            </p>
          </div>
          <span className="mp-open-icon" />
        </div>
      </div>
      {editing && (
        <div className="mp-card-controls">
          <label className="mp-check">
            <MusicSelectionControl disabled tabIndex={-1} />
            <span className="mp-pending-line mp-pending-control" />
          </label>
        </div>
      )}
    </article>
  ));
}
