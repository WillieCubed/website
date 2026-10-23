import type { ReactNode } from 'react';

import { MusicCardCaption, MusicCardOpenTarget } from './MusicCardOpening';
import MusicFeaturedPlaylist from './MusicFeaturedPlaylist';
import type { MusicGalleryItem } from './music-gallery';

interface Props {
  item: MusicGalleryItem;
  editing: boolean;
  href: (id: string) => string;
  onDragStart?: (id: string) => void;
  onDrop?: (id: string) => void;
  openPlaylist: (id: string, source?: HTMLElement) => void;
  controls?: ReactNode;
}
export default function MusicCard({
  item,
  editing,
  href,
  onDragStart,
  onDrop,
  openPlaylist,
  controls,
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
  } = item;
  return (
    <article
      key={playlist.id}
      className={`music-card${featured ? ' music-card-lead' : ''}${editing && !selected ? ' music-card-unselected' : ''}`}
      aria-label={featured ? 'Featured playlist' : undefined}
      data-playlist={playlist.id}
      data-focused={focused || undefined}
      draggable={canReorder}
      onDragStart={() => onDragStart?.(playlist.id)}
      onDragOver={(event) => {
        if (canReorder) event.preventDefault();
      }}
      onDrop={() => onDrop?.(playlist.id)}
    >
      <MusicCardOpenTarget
        playlist={playlist}
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
          openPlaylist={openPlaylist}
          href={href}
        />
      )}
      {controls}
    </article>
  );
}
