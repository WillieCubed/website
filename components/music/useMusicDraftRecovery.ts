'use client';
import { useState } from 'react';

import type { MusicCatalog } from '@/lib/music/types';

import {
  type MusicDraftRecovery,
  recoveredMusicDraft,
  recoveryKey,
} from './music-draft-recovery';

interface Options {
  onRecover: (catalog: MusicCatalog) => void;
}

/** Optional browser recovery survives failed saves without becoming the server base. */
export function useMusicDraftRecovery({ onRecover }: Options) {
  const [recovery, setRecovery] = useState<MusicDraftRecovery | null>(null);
  function discover(saved: MusicCatalog | undefined) {
    const local = recoveredMusicDraft(saved);
    if (local) setRecovery(local);
  }
  function recover() {
    if (!recovery) return;
    onRecover(recovery.catalog);
    setRecovery(null);
  }
  function discard() {
    localStorage.removeItem(recoveryKey);
    setRecovery(null);
  }
  return { available: Boolean(recovery), discover, recover, discard };
}
