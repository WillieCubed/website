'use client';
import { useEffect, useState } from 'react';

import type { MusicCatalog } from '@/lib/music/types';

import type { MusicLibraryLoad } from './useMusicLibrary';

interface Options {
  load: () => Promise<MusicLibraryLoad>;
  refresh: () => Promise<void>;
  discover: (saved: MusicCatalog | undefined) => void;
}
/** Reconcile the connection callback only during the initial library load. */
export function useMusicInitialLoad({ load, refresh, discover }: Options) {
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    load()
      .then(async ({ catalog, conn }) => {
        if (!active) return;
        const params = new URLSearchParams(location.search);
        if (params.get('connectionError'))
          setError(params.get('connectionError')!);
        discover(catalog.revision?.body);
        if (params.has('connected') && conn.connected) {
          window.history.replaceState(null, '', location.pathname);
          await refresh();
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return { error, dismiss: () => setError('') };
}
