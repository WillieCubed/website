'use client';
import { useEffect, useRef, useState } from 'react';

import type { MusicRevision } from '@/lib/music/types';

import { musicAdminRequest } from './music-admin-request';
import { type MusicDraftSnapshot, canRestoreMusic } from './music-draft-guards';

interface Options {
  readDraft: () => MusicDraftSnapshot;
  onRestored: () => Promise<void>;
  setBusy: (busy: boolean) => void;
  setError: (message: string) => void;
}
export function useMusicRevisionHistory({
  readDraft,
  onRestored,
  setBusy,
  setError,
}: Options) {
  const [history, setHistory] = useState<MusicRevision[] | null>(null);
  const historyDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (history) historyDialog.current?.showModal();
    else historyDialog.current?.close();
  }, [history]);
  function openHistory() {
    void musicAdminRequest<{ revisions: MusicRevision[] }>('/history')
      .then((r) => setHistory(r.revisions))
      .catch((e) => setError(e.message));
  }
  async function restore(targetRevisionId: string) {
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
    history,
    historyDialog,
    openHistory,
    closeHistory: () => setHistory(null),
    restore,
  };
}
