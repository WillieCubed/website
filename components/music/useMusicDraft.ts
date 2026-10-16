'use client';
import { useEffect, useRef, useState } from 'react';

import type {
  MusicAdminCollectionData,
  MusicCatalog,
  MusicRevision,
} from '@/lib/music/types';
import { emptyCatalog } from '@/lib/music/types';

import {
  MusicAdminRequestError,
  type MusicRevisionResponse,
  musicAdminRequest,
} from './music-admin-request';
import type { MusicDraftSnapshot } from './music-draft-guards';

interface Options {
  busy: boolean;
  onStaged: (catalog: MusicCatalog, revisionId: string | null) => void;
  onSaved: (revision: MusicRevision) => void;
  onSettled: () => void;
  setStatus: (message: string) => void;
}
export function useMusicDraft({
  busy,
  setStatus,
  onStaged,
  onSaved,
  onSettled,
}: Options) {
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const base = useRef<string | null>(null);
  const pending = useRef<MusicCatalog | null>(null);
  const saved = useRef<MusicCatalog>(emptyCatalog);
  const savingRef = useRef(false);
  const blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function adopt(
    revision: MusicRevision | null,
    fallback: MusicCatalog = emptyCatalog
  ) {
    base.current = revision?.id ?? null;
    saved.current = revision?.body ?? fallback;
  }
  function discardChanges() {
    pending.current = null;
    blocked.current = false;
    setConflict(false);
    setSaving(false);
    setError('');
  }
  function inspect(): MusicDraftSnapshot {
    return {
      revisionId: base.current,
      savedCatalog: saved.current,
      pending: pending.current !== null,
      inFlight: savingRef.current,
      blocked: blocked.current,
    };
  }
  async function drain() {
    if (savingRef.current || blocked.current) return;
    savingRef.current = true;
    setSaving(true);
    let inFlight: MusicCatalog | null = null;
    try {
      while (pending.current) {
        const body = pending.current;
        inFlight = body;
        pending.current = null;
        const result = await musicAdminRequest<MusicRevisionResponse>(
          '/catalog',
          {
            method: 'PUT',
            body: JSON.stringify({
              expectedRevisionId: base.current,
              catalog: body,
            }),
          }
        );
        base.current = result.revision.id;
        saved.current = result.revision.body;
        onSaved(result.revision);
        if (pending.current === null) onSettled();
      }
      setStatus('Saved privately');
      setError('');
    } catch (e) {
      blocked.current = true;
      pending.current ??= inFlight;
      setConflict(e instanceof MusicAdminRequestError && e.status === 409);
      setError((e as Error).message);
      setStatus('Draft needs attention');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  async function retrySave() {
    try {
      if (conflict) {
        const latest =
          await musicAdminRequest<MusicAdminCollectionData>('/catalog');
        base.current = latest.revision?.id ?? null;
      }
      blocked.current = false;
      setConflict(false);
      await drain();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function change(catalog: MusicCatalog): boolean {
    if (busy) return false;
    pending.current = catalog;
    setStatus('Saving…');
    setSaving(true);
    onStaged(catalog, base.current);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void drain(), 650);
    return true;
  }

  return {
    state: { saving, conflict, error },
    dismissError: () => setError(''),
    change,
    retry: retrySave,
    adopt,
    discardChanges,
    inspect,
  };
}
