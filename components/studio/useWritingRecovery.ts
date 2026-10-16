import { useCallback, useEffect, useState } from 'react';

import type { Draft, DraftContent } from '@/lib/studio/types';

import type { WritingSnapshot } from './writing-contracts';

/** Browser retention owns recovery choices; saved revision and edit authority stay in the document. */
export function useWritingRecovery(
  initial: Draft,
  captureSnapshot: () => WritingSnapshot,
  reportStatus: (message: string) => void
) {
  const [recovery, setRecovery] = useState<DraftContent | null>(null);
  const recoveryKey = `studio-draft:${initial.id}`;
  const [openingBody] = useState(() => JSON.stringify(initial.head.body));
  useEffect(() => {
    try {
      const local = sessionStorage.getItem(recoveryKey);
      if (
        local &&
        local !== openingBody &&
        local !== JSON.stringify(captureSnapshot().body)
      )
        setRecovery(JSON.parse(local));
    } catch {
      /* The server revision remains available. */
    }
  }, [recoveryKey, openingBody, captureSnapshot]);
  const retain = useCallback(
    (body: DraftContent) => {
      reportStatus(
        navigator.onLine
          ? 'Unsaved changes'
          : 'Offline · changes kept in this tab'
      );
      try {
        sessionStorage.setItem(recoveryKey, JSON.stringify(body));
      } catch {
        reportStatus(
          'Unsaved changes · browser recovery storage is unavailable'
        );
      }
    },
    [recoveryKey, reportStatus]
  );
  const clear = useCallback(
    () => sessionStorage.removeItem(recoveryKey),
    [recoveryKey]
  );
  function recoverChanges(replaceDocument: (body: DraftContent) => void) {
    if (!recovery) return;
    replaceDocument(recovery);
    setRecovery(null);
  }
  function discardRecovery() {
    try {
      clear();
      setRecovery(null);
    } catch {
      reportStatus(
        'Browser recovery storage is unavailable. Your saved revision is still available.'
      );
    }
  }
  return { recovery, retain, clear, recoverChanges, discardRecovery };
}

interface WritingAutosaveLifecycle {
  body: DraftContent;
  save: () => Promise<boolean>;
  recoveryPending: boolean;
  saveQueue: number;
  hasUnsavedChanges: () => boolean;
  reportStatus: (message: string) => void;
}

/** Schedule semantic saves and retain the unload guard through editor task changes. */
export function useWritingAutosave({
  body,
  save,
  recoveryPending,
  saveQueue,
  hasUnsavedChanges,
  reportStatus,
}: WritingAutosaveLifecycle) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!recoveryPending) void save();
    }, 1000);
    return () => clearTimeout(timer);
  }, [body, save, recoveryPending, saveQueue]);
  useEffect(() => {
    const online = () => {
      void save();
    };
    const offline = () => reportStatus('Offline · changes kept in this tab');
    const leave = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges()) event.preventDefault();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('beforeunload', leave);
    };
  }, [save, hasUnsavedChanges, reportStatus]);
}
