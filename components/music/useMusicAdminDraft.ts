'use client';
import { useState } from 'react';

import {
  type MusicAdminCollectionData,
  type MusicCatalog,
  type MusicRevision,
} from '@/lib/music/types';

import { loadedMusicCatalog } from './music-admin-collection';
import {
  type MusicDraftRecovery,
  clearMusicDraftRecovery,
  recoveredMusicDraft,
  recoveryKey,
  rememberMusicDraft,
} from './music-draft-recovery';
import { useMusicDraft } from './useMusicDraft';

interface Options {
  busy: boolean;
  setStatus: (status: string) => void;
  onStaged: () => void;
}
/** Keep server draft adoption and optional browser recovery on the same collection lifetime. */
export function useMusicAdminDraft({ busy, setStatus, onStaged }: Options) {
  const [error, setError] = useState('');
  const collection = useMusicCollection();
  const draft = useMusicDraft({
    busy,
    setStatus,
    onSaved: collection.acceptRevision,
    onSettled: settle,
    onStaged: retain,
  });
  const recovery = useMusicDraftRecovery({ onRecover: recover });
  function acceptCollection(catalog: MusicAdminCollectionData) {
    draft.adopt(catalog.revision, loadedMusicCatalog(catalog));
    collection.accept(catalog);
  }
  function acceptImportedRevision(
    revision: MusicRevision,
    catalog: MusicAdminCollectionData
  ) {
    draft.adopt(revision);
    collection.accept({ ...catalog, revision });
  }
  function settle() {
    clearMusicDraftRecovery();
    setError('');
  }
  function retain(catalog: MusicCatalog, revisionId: string | null) {
    onStaged();
    if (!rememberMusicDraft(catalog, revisionId))
      setError(
        'Browser recovery is unavailable. Keep this tab open until the save finishes.'
      );
  }
  function recover(catalog: MusicCatalog): boolean {
    if (!draft.change(catalog)) return false;
    collection.recover(catalog);
    return true;
  }
  async function loadSavedDraft(load: () => Promise<unknown>) {
    try {
      await load();
      draft.discardChanges();
      settle();
      collection.remount();
    } catch {
      /* The library owns and displays its failed load. */
    }
  }
  async function reloadRestored(load: () => Promise<unknown>) {
    draft.discardChanges();
    await load();
    collection.remount();
  }
  return {
    collection,
    loadSavedDraft,
    reloadRestored,
    draft,
    recovery,
    acceptCollection,
    acceptImportedRevision,
    retention: { error, dismiss: () => setError('') },
  };
}

/** The editor's loaded data and the moments that replace its local session. */
function useMusicCollection() {
  const [data, setData] = useState<MusicAdminCollectionData | null>(null);
  const [generation, setGeneration] = useState(0);
  const [editorCatalog, setEditorCatalog] = useState<MusicCatalog | null>(null);

  function accept(catalog: MusicAdminCollectionData) {
    setData(catalog);
    setEditorCatalog(null);
  }
  function acceptRevision(revision: MusicRevision) {
    setData((current) => (current ? { ...current, revision } : current));
  }
  function remount() {
    setGeneration((current) => current + 1);
  }
  function recover(catalog: MusicCatalog) {
    setEditorCatalog(catalog);
    remount();
  }
  return {
    data,
    generation,
    editorCatalog,
    accept,
    acceptRevision,
    recover,
    remount,
  };
}

interface RecoveryOptions {
  onRecover: (catalog: MusicCatalog) => boolean;
}

/** Optional browser recovery survives failed saves without becoming the server base. */
function useMusicDraftRecovery({ onRecover }: RecoveryOptions) {
  const [recovery, setRecovery] = useState<MusicDraftRecovery | null>(null);
  function discover(saved: MusicCatalog | undefined) {
    const local = recoveredMusicDraft(saved);
    if (local) setRecovery(local);
  }
  function recover() {
    if (!recovery || !onRecover(recovery.catalog)) return;
    setRecovery(null);
  }
  function discard() {
    localStorage.removeItem(recoveryKey);
    setRecovery(null);
  }
  return { available: Boolean(recovery), discover, recover, discard };
}
