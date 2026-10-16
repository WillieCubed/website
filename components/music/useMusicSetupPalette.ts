'use client';
import { useEffect } from 'react';

import { usePalette } from '@/components/search/palette/PaletteProvider';

import type { PlaylistView } from '@/lib/music/presentation';

interface Options {
  enabled: boolean;
  playlists: PlaylistView[];
  selected: string[];
  toggle: (id: string) => void;
}
export function useMusicSetupPalette({
  enabled,
  playlists,
  selected,
  toggle,
}: Options) {
  const { close: closePalette, registerCommands } = usePalette();
  useEffect(() => {
    if (!enabled) return;
    return registerCommands(
      playlists
        .filter((playlist) => playlist.eligible)
        .map((playlist) => ({
          id: `music:select:${playlist.id}`,
          title: playlist.title,
          detail: selected.includes(playlist.id)
            ? 'Remove from your collection'
            : 'Add to your collection',
          group: 'Playlists' as const,
          keywords: ['playlist', 'music', 'select'],
          kind: 'music' as const,
          run: async () => {
            await closePalette({ animate: false, restoreFocus: false });
            toggle(playlist.id);
            const row = [
              ...document.querySelectorAll<HTMLElement>('.ms-playlist'),
            ].find((item) => item.dataset.playlist === playlist.id);
            row
              ?.querySelector<HTMLInputElement>('input')
              ?.focus({ preventScroll: true });
            row?.scrollIntoView({
              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
              block: 'center',
            });
          },
        }))
    );
  }, [enabled, playlists, selected, registerCommands, closePalette]);
}
