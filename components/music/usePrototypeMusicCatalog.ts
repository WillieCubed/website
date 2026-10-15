'use client';
import { useEffect, useState } from 'react';

import type { Catalog, MusicMode } from '@/lib/music/presentation';

import {
  MUSIC_PROTOTYPE_STORAGE_KEY,
  readPrototypeCatalog,
} from './music-prototype-storage';

interface Options {
  mode: MusicMode;
  live: Catalog;
  draft: Catalog;
  validCatalog?: (value: unknown) => value is Catalog;
  restore: (live: Catalog, draft: Catalog) => void;
}

/** Prototype persistence is optional; it never replaces server-owned drafts. */
export function usePrototypeMusicCatalog({
  mode,
  live,
  draft,
  validCatalog,
  restore,
}: Options) {
  const [ready, setReady] = useState(mode !== 'prototype');
  const [error, setError] = useState('');
  useEffect(() => {
    if (mode !== 'prototype') {
      setReady(true);
      return;
    }
    try {
      const saved = readPrototypeCatalog(localStorage, validCatalog);
      if (saved) restore(saved.live, saved.draft);
    } catch {
      setError(
        'The local draft could not be restored. This session uses the sample collection.'
      );
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || mode !== 'prototype') return;
    try {
      localStorage.setItem(
        MUSIC_PROTOTYPE_STORAGE_KEY,
        JSON.stringify({ live, draft })
      );
    } catch {
      setError(
        'Browser storage is unavailable. Keep this tab open to retain changes.'
      );
    }
  }, [live, draft, ready]);
  return { ready, error };
}
