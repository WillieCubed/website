'use client';
import { useEffect, useState } from 'react';

import SiteLink from '@/components/link/SiteLink';
import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';

import { emptyCatalog } from '@/lib/music/types';
import type {
  MusicAdminCollectionData,
  MusicCatalog,
  MusicPublication,
  MusicRevision,
} from '@/lib/music/types';

import {
  MusicPublicationNotice,
  MusicRecoveryNotice,
  MusicSaveNotice,
} from './MusicAdminNotices';
import MusicExperience from './MusicExperience';
import MusicRevisionHistory from './MusicRevisionHistory';
import { adminCollectionView } from './music-admin-collection';
import { canPublishMusic } from './music-draft-guards';
import {
  clearMusicDraftRecovery,
  rememberMusicDraft,
} from './music-draft-recovery';
import { useMusicCollection } from './useMusicCollection';
import { useMusicDraft } from './useMusicDraft';
import { useMusicDraftRecovery } from './useMusicDraftRecovery';
import { useMusicLibrary } from './useMusicLibrary';
import { useMusicPublication } from './useMusicPublication';
import { useMusicRevisionHistory } from './useMusicRevisionHistory';

export default function MusicAdmin() {
  const [status, setStatus] = useState('Loading playlists…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const collection = useMusicCollection();
  const draft = useMusicDraft({
    busy,
    setError,
    setStatus,
    onSaved: collection.acceptRevision,
    onSettled: clearMusicDraftRecovery,
    onStaged: retainLocalDraft,
  });
  const recovery = useMusicDraftRecovery({
    onRecover: recoverLocalDraft,
  });
  const publication = useMusicPublication({
    readDraft: draft.inspect,
    busy,
    setBusy,
    setError,
  });

  function acceptCollection(catalog: MusicAdminCollectionData) {
    draft.adopt(catalog.revision, {
      ...emptyCatalog,
      order: catalog.playlists.map((playlist) => playlist.id),
    });
    collection.accept(catalog);
  }
  function acceptImportedRevision(
    revision: MusicRevision,
    catalog: MusicAdminCollectionData
  ) {
    draft.adopt(revision);
    collection.accept({ ...catalog, revision });
  }
  const library = useMusicLibrary({
    acceptCollection,
    acceptImportedRevision,
    acceptPublication: publication.acceptPublication,
    readDraft: draft.inspect,
    remount: collection.remount,
    setBusy,
    setError,
    setStatus,
  });
  const history = useMusicRevisionHistory({
    readDraft: draft.inspect,
    onRestored: reloadRestoredDraft,
    setBusy,
    setError,
  });
  useEffect(() => {
    let active = true;
    library
      .load()
      .then(async ({ catalog, conn }) => {
        if (!active) return;
        const params = new URLSearchParams(location.search);
        if (params.get('connectionError'))
          setError(params.get('connectionError')!);
        recovery.discover(catalog.revision?.body);
        if (params.has('connected') && conn.connected) {
          window.history.replaceState(null, '', location.pathname);
          await library.refresh();
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  async function loadSavedDraft() {
    try {
      await library.load();
      draft.discardChanges();
      setError('');
      clearMusicDraftRecovery();
      collection.remount();
    } catch (error) {
      setError((error as Error).message);
    }
  }
  function retryLoad() {
    setError('');
    void library
      .load()
      .catch(() => setError('The collection could not load. Try again.'));
  }
  function retainLocalDraft(catalog: MusicCatalog, revisionId: string | null) {
    publication.clearPublication();
    if (!rememberMusicDraft(catalog, revisionId))
      setError(
        'Browser recovery is unavailable. Keep this tab open until the save finishes.'
      );
  }
  function recoverLocalDraft(catalog: MusicCatalog) {
    collection.recover(catalog, draft.inspect().revisionId);
    draft.change(catalog);
  }
  async function reloadRestoredDraft() {
    draft.discardChanges();
    await library.load();
    collection.remount();
  }
  function retryPublication() {
    return publication.publish(draft.inspect().savedCatalog);
  }
  const currentDraft = draft.inspect();
  const { playlists, initialCatalog, loading, connected, setupInitially } =
    adminCollectionView(collection.data, library.connection);
  const canReview = !draft.state.saving && canPublishMusic(currentDraft, busy);
  const published = isPublishedDraft(
    publication.publication,
    collection.data,
    currentDraft.pending,
    draft.state.saving
  );
  const adminMenuItems: BreadcrumbMenuItem[] = [
    { label: 'History', onSelect: history.openHistory },
    ...(!connected
      ? [
          {
            label: 'Reconnect Spotify',
            onSelect: () => void library.connect(),
          },
        ]
      : []),
  ];
  return (
    <>
      <noscript>
        <p>
          This curation tool needs JavaScript.{' '}
          <SiteLink href="/music">Browse the music collection</SiteLink>.
        </p>
      </noscript>
      <div className="music-admin-notices">
        <MusicSaveNotice
          error={error}
          blocked={currentDraft.blocked}
          conflict={draft.state.conflict}
          reconnect={Boolean(library.connection?.reconnect)}
          onRetry={draft.retry}
          onUseSaved={loadSavedDraft}
          onConnect={library.connect}
          onDismiss={() => setError('')}
        />
        {busy && (
          <p role="status">
            {status === 'Importing Spotify playlists…' ? status : 'Working…'}
          </p>
        )}
        <MusicRecoveryNotice
          available={recovery.available}
          onRecover={recovery.recover}
          onDiscard={recovery.discard}
        />
        <MusicPublicationNotice
          publication={publication.publication}
          visible={publication.showPublicationNotice}
          onRetry={retryPublication}
          onDismiss={publication.dismissNotice}
        />
      </div>
      <MusicExperience
        key={collection.generation}
        mode="admin"
        playlists={playlists}
        initialCatalog={initialCatalog}
        loading={loading}
        connected={connected}
        setupInitially={setupInitially}
        saveStatus={status}
        loadError={error}
        interactionLocked={busy}
        canReview={canReview}
        published={published}
        onChange={draft.change}
        onPublish={publication.publish}
        onConnect={library.connect}
        onRefresh={library.refresh}
        adminMenuItems={adminMenuItems}
        onRetry={retryLoad}
      />
      <MusicRevisionHistory
        revisions={history.history}
        dialog={history.historyDialog}
        busy={busy}
        currentRevisionId={currentDraft.revisionId}
        onClose={history.closeHistory}
        onRestore={history.restore}
      />
    </>
  );
}

function isPublishedDraft(
  publication: MusicPublication | null,
  collection: MusicAdminCollectionData | null,
  pending: boolean,
  saving: boolean
): boolean {
  return (
    publication?.status === 'live' &&
    publication.revisionId === collection?.revision?.id &&
    !pending &&
    !saving
  );
}
