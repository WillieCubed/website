'use client';

import { useCallback, useRef, useState } from 'react';

import type { Draft } from '@/lib/studio/types';
import type { DraftContent } from '@/lib/studio/types';

import { studioRequest } from './api';
import { useWritingAutosave, useWritingRecovery } from './useWritingRecovery';
import type { WritingDocument, WritingSnapshot } from './writing-contracts';
import type { DraftEditing, DraftUpdate } from './writing-contracts';

/** Autosave snapshots against the expected revision; newer local edits remain queued. */
interface SaveFailure extends Error {
  status?: number;
}

export function useWritingDocument(initial: Draft): WritingDocument {
  const [draft, setDraft] = useState(initial);
  const headRef = useRef(initial.head.id);
  const saved = useRef(JSON.stringify(initial.head.body));
  const saving = useRef(false);
  const [saveQueue, setSaveQueue] = useState(0);
  const [status, setStatus] = useState('All changes saved');
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef(false);
  const reportStatus = useCallback((message: string) => setStatus(message), []);
  const content = useWritingContent(initial.head.body, (next) =>
    retained.retain(next)
  );
  const { body, captureSnapshot, isCurrent } = content;
  const retained = useWritingRecovery(initial, captureSnapshot, reportStatus);
  function reportSaveFailure(error: unknown) {
    const failure = describeSaveFailure(error);
    if (failure.conflict) {
      conflictRef.current = true;
      setConflict(true);
    }
    setStatus(failure.message);
  }
  const save = useCallback(async (): Promise<boolean> => {
    if (saving.current || conflictRef.current) return false;
    const snapshot = captureSnapshot().body;
    const serialized = JSON.stringify(snapshot);
    if (serialized === saved.current) {
      setStatus('All changes saved');
      return true;
    }
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
        serialized === JSON.stringify(captureSnapshot().body)
          ? 'All changes saved'
          : 'Unsaved changes'
      );
      if (serialized === JSON.stringify(captureSnapshot().body))
        retained.clear();
      return serialized === JSON.stringify(captureSnapshot().body);
    } catch (error) {
      reportSaveFailure(error);
      return false;
    } finally {
      saving.current = false;
      if (committed && serialized !== JSON.stringify(captureSnapshot().body))
        setSaveQueue((value) => value + 1);
    }
  }, [initial.id, retained.clear, captureSnapshot]);
  const hasUnsavedChanges = useCallback(
    () => JSON.stringify(captureSnapshot().body) !== saved.current,
    [captureSnapshot]
  );
  useWritingAutosave({
    body,
    save,
    recoveryPending: retained.recovery !== null,
    saveQueue,
    hasUnsavedChanges,
    reportStatus,
  });
  async function rebaseChanges() {
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

  async function selectSavedRevision(snapshot: WritingSnapshot) {
    if (!(await save())) {
      setStatus('Save your changes before reviewing publication.');
      return null;
    }
    if (!isCurrent(snapshot)) {
      setStatus('Your writing changed. Review it again.');
      return null;
    }
    try {
      const current = await studioRequest<Draft>(`/documents/${initial.id}`);
      if (!isCurrent(snapshot)) {
        setStatus('Your writing changed. Review it again.');
        return null;
      }
      if (current.head.id !== headRef.current) {
        setStatus(
          'A newer revision exists. Load it before reviewing publication.'
        );
        return null;
      }
      return current.head;
    } catch (error) {
      setStatus((error as Error).message);
      return null;
    }
  }
  const refreshPublicationMetadata = useCallback(async () => {
    try {
      const remote = await studioRequest<Draft>(`/documents/${initial.id}`);
      // Publication completion must not adopt another tab's head or replace local edits.
      setDraft((current) => ({
        ...current,
        liveRevisionId: remote.liveRevisionId,
      }));
    } catch (error) {
      setStatus((error as Error).message);
    }
  }, [initial.id]);

  return {
    ...content,
    draft,
    dirty: JSON.stringify(body) !== saved.current,
    status,
    reportStatus,
    conflict,
    recovery: retained.recovery,
    recoverChanges: retained.recoverChanges,
    discardRecovery: retained.discardRecovery,
    save,
    rebaseChanges,
    selectSavedRevision,
    refreshPublicationMetadata,
  };
}

interface SaveFailureDescription {
  conflict: boolean;
  message: string;
}

function describeSaveFailure(error: unknown): SaveFailureDescription {
  const conflict = (error as SaveFailure).status === 409;
  return {
    conflict,
    message: conflict
      ? 'Another revision was saved. Your changes are kept in this tab.'
      : `Could not save · ${(error as Error).message}`,
  };
}

/** One owner advances working content and edit versions together, including identical edits. */
function useWritingContent(
  initial: DraftContent,
  onEdit: (body: DraftContent) => void
): DraftEditing {
  const [body, setBody] = useState(initial);
  const current = useRef(initial);
  const editVersion = useRef(0);
  const update = useCallback(
    (change: DraftUpdate) => {
      const next =
        typeof change === 'function' ? change(current.current) : change;
      editVersion.current += 1;
      current.current = next;
      setBody(next);
      onEdit(next);
    },
    [onEdit]
  );
  const captureSnapshot = useCallback(
    (): WritingSnapshot => ({
      body: current.current,
      editVersion: editVersion.current,
    }),
    []
  );
  const isCurrent = useCallback(
    (snapshot: WritingSnapshot) => snapshot.editVersion === editVersion.current,
    []
  );
  return { body, update, captureSnapshot, isCurrent };
}
