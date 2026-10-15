'use client';
import { useEffect } from 'react';

import { usePalette } from '@/components/search/palette/PaletteProvider';

import { musicAliases } from '@/lib/music/easter-eggs';

interface PlaylistSummary {
  id: string;
  title: string;
}

interface Options {
  enabled: boolean;
  playlists: PlaylistSummary[];
  onOpenPlaylist: (id: string) => void;
}
export function useMusicPaletteNavigation({
  enabled,
  playlists,
  onOpenPlaylist,
}: Options) {
  const { close: closePalette, registerCommands } = usePalette();
  useEffect(() => {
    if (!enabled) return;
    return registerCommands(
      playlists.map((playlist) => ({
        id: `music:open:${playlist.id}`,
        title: playlist.title,
        detail: 'Open playlist',
        group: 'Playlists' as const,
        keywords: ['music', 'playlist', ...musicAliases(playlist.id)],
        kind: 'music' as const,
        run: async () => {
          await closePalette({ animate: false, restoreFocus: false });
          onOpenPlaylist(playlist.id);
        },
      }))
    );
  }, [enabled, playlists, onOpenPlaylist, registerCommands, closePalette]);
}
