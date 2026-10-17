import type { ReactNode } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import { isPlainClick } from '@/lib/dom/click';
import type { PlaylistView } from '@/lib/music/presentation';

import MusicCover from './MusicCover';

interface OpeningProps {
  href: string;
  playlist: PlaylistView;
  onOpen: (id: string, source?: HTMLElement) => void;
  children: ReactNode;
}
export function MusicCardOpenTarget({
  playlist,
  href,
  onOpen,
  children,
}: OpeningProps) {
  return (
    <SiteLink
      href={href}
      preview={false}
      prefetch={false}
      className="music-card-open"
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onOpen(playlist.id, event.currentTarget);
      }}
      aria-label={`Open ${playlist.title}`}
    >
      <div className="music-art-frame" data-card-surface="">
        <div
          className="music-art"
          data-card-cover=""
          style={{ background: playlist.color }}
        >
          <MusicCover playlist={playlist} />
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
    <div className="music-card-caption">
      <div>
        <h3>{playlist.title}</h3>
        <p className="music-small">
          {inSeries ? `${index + 1} of ${total} · ` : ''}
          {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
        </p>
      </div>
      <span className="music-open-icon">
        <Icon name="arrow-right" size={20} />
      </span>
    </div>
  );
}
