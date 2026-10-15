'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { Draft, DraftContent } from '@/lib/studio/types';

import { studioRequest } from './api';

/** Autosave snapshots against the expected revision; newer local edits remain queued. */
export function useWritingDocument(initial: Draft) {
  const [draft, setDraft] = useState(initial);
  const [body, setBody] = useState(initial.head.body);
  const bodyRef = useRef(body);
  const headRef = useRef(initial.head.id);
  const saved = useRef(JSON.stringify(body));
  const saving = useRef(false);
  const [saveQueue, setSaveQueue] = useState(0);
  const [status, setStatus] = useState('All changes saved');
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef(false);
  const [recovery, setRecovery] = useState<DraftContent | null>(null);
  const recoveryKey = `studio-draft:${initial.id}`;
  const update = useCallback(
    (next: DraftContent) => {
      bodyRef.current = next;
      setBody(next);
      setStatus(
        navigator.onLine
          ? 'Unsaved changes'
          : 'Offline · changes kept in this tab'
      );
      try {
        sessionStorage.setItem(recoveryKey, JSON.stringify(next));
      } catch {
        setStatus('Unsaved changes · browser recovery storage is unavailable');
      }
    },
    [recoveryKey]
  );

  useEffect(() => {
    try {
      const local = sessionStorage.getItem(recoveryKey);
      if (
        local &&
        local !== saved.current &&
        local !== JSON.stringify(bodyRef.current)
      )
        setRecovery(JSON.parse(local));
    } catch {
      /* The server revision remains available. */
    }
  }, [recoveryKey]);
  function handleSaveError(error: unknown): void {
    if ((error as { status?: number }).status === 409) {
      conflictRef.current = true;
      setConflict(true);
      setStatus(
        'Another revision was saved. Your changes are kept in this tab.'
      );
    } else setStatus(`Could not save · ${(error as Error).message}`);
  }
  const save = useCallback(async (): Promise<boolean> => {
    if (saving.current || conflictRef.current) return false;
    const snapshot = bodyRef.current;
    const serialized = JSON.stringify(snapshot);
    if (serialized === saved.current) return true;
    if (!navigator.onLine) {
      setStatus('Offline · changes kept in this tab');
      return false;
    }
    saving.current = true;
    let committed = false;
    setStatus('Saving…');
    try {
      const next = await studioRequest<Draft>(`/documents/${initial.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          expectedRevisionId: headRef.current,
          body: snapshot,
        }),
      });
      headRef.current = next.head.id;
      saved.current = serialized;
      committed = true;
      setDraft(next);
      setStatus(
        serialized === JSON.stringify(bodyRef.current)
          ? 'All changes saved'
          : 'Unsaved changes'
      );
      if (serialized === JSON.stringify(bodyRef.current))
        sessionStorage.removeItem(recoveryKey);
      return serialized === JSON.stringify(bodyRef.current);
    } catch (error) {
      handleSaveError(error);
      return false;
    } finally {
      saving.current = false;
      if (committed && serialized !== JSON.stringify(bodyRef.current))
        setSaveQueue((value) => value + 1);
    }
  }, [initial.id, recoveryKey]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!recovery) void save();
    }, 1000);
    return () => clearTimeout(timer);
  }, [body, save, recovery, saveQueue]);
  useEffect(() => {
    const online = () => {
      void save();
    };
    const offline = () => setStatus('Offline · changes kept in this tab');
    const leave = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(bodyRef.current) !== saved.current)
        event.preventDefault();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('beforeunload', leave);
    };
  }, [save]);
  async function reloadHead() {
    try {
      const remote = await studioRequest<Draft>(`/documents/${draft.id}`);
      headRef.current = remote.head.id;
      saved.current = JSON.stringify(remote.head.body);
      setDraft(remote);
      conflictRef.current = false;
      setConflict(false);
      setStatus(
        'Latest revision loaded. Your retained changes are ready to save as a new revision.'
      );
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  return {
    draft,
    setDraft,
    body,
    bodyRef,
    headRef,
    saved,
    status,
    setStatus,
    conflict,
    recovery,
    setRecovery,
    recoveryKey,
    update,
    save,
    reloadHead,
  };
}
