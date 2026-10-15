'use client';
import type { ComponentType, ReactNode } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import { isPlainClick } from '@/lib/dom/click';
import type { PlaylistView } from '@/lib/music/presentation';

interface OpeningProps {
  href: string;
  playlist: PlaylistView;
  Cover: ComponentType<{ playlist: PlaylistView }>;
  onOpen: (id: string, source?: HTMLElement) => void;
  children: ReactNode;
}
export function MusicCardOpenTarget({
  playlist,
  href,
  Cover,
  onOpen,
  children,
}: OpeningProps) {
  return (
    <SiteLink
      href={href}
      preview={false}
      prefetch={false}
      className="mp-card-open"
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onOpen(playlist.id, event.currentTarget);
      }}
      aria-label={`Open ${playlist.title}`}
    >
      <div className="mp-art-frame" data-card-surface="">
        <div
          className="mp-art"
          data-card-cover=""
          style={{ background: playlist.color }}
        >
          <Cover playlist={playlist} />
        </div>
      </div>
      {children}
    </SiteLink>
  );
}
interface PlaylistCaptionProps {
  playlist: PlaylistView;
  index: number;
  inSeries: boolean;
  total: number;
}

export function MusicCardCaption({
  playlist,
  index,
  inSeries,
  total,
}: PlaylistCaptionProps) {
  return (
    <div className="mp-card-caption">
      <div>
        <h3>{playlist.title}</h3>
        <p className="mp-small">
          {inSeries ? `${index + 1} of ${total} · ` : ''}
          {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
        </p>
      </div>
      <span className="mp-open-icon">
        <Icon name="arrow-right" size={20} />
      </span>
    </div>
  );
}
