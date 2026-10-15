'use client';
import { useEffect } from 'react';
import { flushSync } from 'react-dom';

import { usePalette } from '@/components/search/palette/PaletteProvider';

import { musicAliases } from '@/lib/music/easter-eggs';
import type {
  Catalog,
  MusicMode,
  PlaylistView,
} from '@/lib/music/presentation';

import { musicHref } from './useMusicPlaylistDialog';

interface Options {
  setup: boolean;
  mode: MusicMode;
  catalog: Catalog;
  editing: boolean;
  playlists: PlaylistView[];
  displayed: string[];
  revealAll: () => void;
}
export function useMusicPaletteNavigation({
  setup,
  mode,
  catalog,
  editing,
  playlists,
  displayed,
  revealAll,
}: Options) {
  const { close: closePalette, registerCommands } = usePalette();
  useEffect(() => {
    if (setup) return;
    const ids = catalog.order.filter(
      (id) => editing || catalog.selected.includes(id)
    );
    return registerCommands(
      ids.flatMap((id) => {
        const playlist = playlists.find((item) => item.id === id);
        if (!playlist) return [];
        return [
          {
            id: `music:open:${id}`,
            title: playlist.title,
            detail: 'Open playlist',
            group: 'Playlists' as const,
            keywords: ['music', 'playlist', ...musicAliases(playlist.id)],
            kind: 'music' as const,
            run: async () => {
              await closePalette({ animate: false, restoreFocus: false });
              if (!displayed.includes(id)) {
                flushSync(() => {
                  revealAll();
                });
                history.pushState(null, '', musicHref(null, null, mode));
              }
              const card = [
                ...document.querySelectorAll<HTMLElement>('.mp-card'),
              ].find((item) => item.dataset.playlist === id);
              card?.scrollIntoView({ behavior: 'instant', block: 'center' });
              card?.querySelector<HTMLButtonElement>('.mp-card-open')?.click();
            },
          },
        ];
      })
    );
  }, [
    setup,
    catalog,
    editing,
    playlists,
    displayed.join(','),
    registerCommands,
    closePalette,
  ]);
}
