'use client';
import { useState } from 'react';

import type { MusicRevision } from '@/lib/music/types';

import { musicAdminRequest } from './music-admin-request';
import { type MusicDraftSnapshot, canRestoreMusic } from './music-draft-guards';

interface MusicRevisionHistoryResponse {
  revisions: MusicRevision[];
}

interface Options {
  readDraft: () => MusicDraftSnapshot;
  onRestored: () => Promise<void>;
  setBusy: (busy: boolean) => void;
}
export function useMusicRevisionHistory({
  readDraft,
  onRestored,
  setBusy,
}: Options) {
  const [error, setError] = useState('');
  const [history, setHistory] = useState<MusicRevision[] | null>(null);
  function openHistory() {
    setError('');
    void musicAdminRequest<MusicRevisionHistoryResponse>('/history')
      .then((r) => setHistory(r.revisions))
      .catch((e) => setError(e.message));
  }
  async function restore(targetRevisionId: string) {
    setError('');
    const draft = readDraft();
    if (!canRestoreMusic(draft)) {
      setError('Wait for the draft to save before restoring history.');
      return;
    }
    setBusy(true);
    try {
      await musicAdminRequest('/history', {
        method: 'POST',
        body: JSON.stringify({
          revisionId: targetRevisionId,
          expectedRevisionId: draft.revisionId,
        }),
      });
      await onRestored();
      setHistory(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return {
    error,
    dismissError: () => setError(''),
    history,
    openHistory,
    closeHistory: () => setHistory(null),
    restore,
  };
}
