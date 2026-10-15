'use client';
import type { ComponentType } from 'react';

import MusicCardControls from './MusicCardControls';
import { MusicCardCaption, MusicCardOpenTarget } from './MusicCardOpening';
import type { MusicCoverProps } from './MusicCover';
import MusicFeaturedPlaylist from './MusicFeaturedPlaylist';
import type { MusicGalleryItem } from './music-gallery';

interface Props {
  item: MusicGalleryItem;
  Cover: ComponentType<MusicCoverProps>;
  editing: boolean;
  href: (id: string) => string;
  onDragStart: (id: string) => void;
  onDrop: (id: string) => void;
  openPlaylist: (id: string, source?: HTMLElement) => void;
  select: (id: string) => void;
  reorder: (id: string, step: number) => void;
}
export default function MusicCard({
  item,
  Cover,
  editing,
  href,
  onDragStart,
  onDrop,
  openPlaylist,
  select,
  reorder,
}: Props) {
  const {
    playlist,
    selected,
    featured,
    focused,
    index,
    total,
    inSeries,
    note,
    memberships,
    canReorder,
    curation,
  } = item;
  return (
    <article
      key={playlist.id}
      className={`mp-card${featured ? ' mp-card-lead' : ''}${editing && !selected ? ' mp-card-unselected' : ''}`}
      aria-label={featured ? 'Featured playlist' : undefined}
      data-playlist={playlist.id}
      data-focused={focused || undefined}
      draggable={canReorder}
      onDragStart={() => onDragStart(playlist.id)}
      onDragOver={(event) => {
        if (canReorder) event.preventDefault();
      }}
      onDrop={() => onDrop(playlist.id)}
    >
      <MusicCardOpenTarget
        playlist={playlist}
        Cover={Cover}
        onOpen={openPlaylist}
        href={href(playlist.id)}
      >
        {!featured && (
          <MusicCardCaption
            playlist={playlist}
            index={index}
            inSeries={inSeries}
            total={total}
          />
        )}
      </MusicCardOpenTarget>
      {featured && (
        <MusicFeaturedPlaylist
          playlist={playlist}
          note={note}
          memberships={memberships}
          Cover={Cover}
          openPlaylist={openPlaylist}
          href={href}
        />
      )}
      {editing && (
        <MusicCardControls
          playlist={playlist}
          selected={selected}
          controls={curation}
          select={select}
          reorder={reorder}
        />
      )}
    </article>
  );
}
