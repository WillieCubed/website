'use client';
import { useState } from 'react';

import {
  type MusicAdminCollectionData,
  type MusicCatalog,
  type MusicRevision,
} from '@/lib/music/types';

import { loadedMusicCatalog } from './music-admin-collection';
import {
  clearMusicDraftRecovery,
  rememberMusicDraft,
} from './music-draft-recovery';
import { useMusicCollection } from './useMusicCollection';
import { useMusicDraft } from './useMusicDraft';
import { useMusicDraftRecovery } from './useMusicDraftRecovery';

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
