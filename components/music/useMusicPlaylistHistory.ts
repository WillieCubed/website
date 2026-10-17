'use client';
import { useEffect, useRef } from 'react';

import type {
  Catalog,
  MusicMode,
  PlaylistView,
} from '@/lib/music/presentation';

interface Options {
  catalog: Catalog;
  editing: boolean;
  playlists: PlaylistView[];
  mode: MusicMode;
  onLocation: (
    series: string | null,
    detail: string | null,
    external: boolean
  ) => void;
}
/** Own the history entry created by opening a playlist, independently of its motion. */
export function useMusicPlaylistHistory({
  catalog,
  editing,
  playlists,
  mode,
  onLocation,
}: Options) {
  const ownDetailEntry = useRef(false);
  const ownPop = useRef(false);
  useEffect(() => {
    const sync = (external = false) => {
      const params = new URLSearchParams(location.search);
      const series = params.get('series');
      const detail = params.get('detail');
      const allowed =
        playlists.some((item) => item.id === detail) &&
        (editing || catalog.selected.includes(detail!));
      if (external) ownDetailEntry.current = false;
      onLocation(
        catalog.series.some((item) => item.id === series) ? series : null,
        allowed ? detail : null,
        external
      );
    };
    sync();
    const pop = () => {
      if (ownPop.current) {
        ownPop.current = false;
        return;
      }
      sync(true);
    };
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, [catalog, editing]);
  function open(series: string | null, detail: string, alreadyOpen: boolean) {
    if (alreadyOpen)
      history.replaceState(null, '', musicHref(series, detail, mode));
    else {
      history.pushState(null, '', musicHref(series, detail, mode));
      ownDetailEntry.current = true;
    }
  }
  function close(series: string | null) {
    if (ownDetailEntry.current) {
      ownPop.current = true;
      history.back();
    } else history.replaceState(null, '', musicHref(series, null, mode));
    ownDetailEntry.current = false;
  }
  function openRelated(
    series: string | null,
    detail: string,
    alreadyOpen: boolean
  ) {
    open(series, detail, alreadyOpen);
    // A cross-collection destination closes to its own gallery, like its native URL.
    ownDetailEntry.current = false;
  }
  return { open, openRelated, close };
}
export function musicHref(
  nextSeries: string | null,
  detail: string | null,
  mode: MusicMode
) {
  const params = new URLSearchParams();
  if (nextSeries) params.set('series', nextSeries);
  if (detail) params.set('detail', detail);
  const path = mode === 'admin' ? '/studio/music' : '/music';
  return `${path}${params.size > 0 ? `?${params}` : ''}`;
}
