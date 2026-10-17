'use client';
import { useState } from 'react';

import Icon from '@/components/icons/Icon';

import type { PlaylistView } from '@/lib/music/presentation';

interface MusicCoverProps {
  playlist: PlaylistView;
}

export default function MusicCover({ playlist }: MusicCoverProps) {
  const [failed, setFailed] = useState(false);
  return playlist.image && !failed ? (
    // Spotify artwork is rendered uncropped and unmodified.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="music-cover"
      src={playlist.image}
      alt=""
      aria-hidden="true"
      width={640}
      height={640}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="music-cover music-cover-missing" aria-hidden="true">
      <Icon name="music" size={64} />
    </span>
  );
}
