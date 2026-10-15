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
  MusicOperationNotice,
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
  const [callbackError, setCallbackError] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [busy, setBusy] = useState(false);
  const collection = useMusicCollection();
  const draft = useMusicDraft({
    busy,
    setStatus,
    onSaved: collection.acceptRevision,
    onSettled: settleLocalDraft,
    onStaged: retainLocalDraft,
  });
  const recovery = useMusicDraftRecovery({
    onRecover: recoverLocalDraft,
  });
  const publication = useMusicPublication({
    readDraft: draft.inspect,
    busy,
    setBusy,
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
    setStatus,
  });
  const history = useMusicRevisionHistory({
    readDraft: draft.inspect,
    onRestored: reloadRestoredDraft,
    setBusy,
  });
  useEffect(() => {
    let active = true;
    library
      .load()
      .then(async ({ catalog, conn }) => {
        if (!active) return;
        const params = new URLSearchParams(location.search);
        if (params.get('connectionError'))
          setCallbackError(params.get('connectionError')!);
        recovery.discover(catalog.revision?.body);
        if (params.has('connected') && conn.connected) {
          window.history.replaceState(null, '', location.pathname);
          await library.refresh();
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  async function loadSavedDraft() {
    try {
      await library.load();
      draft.discardChanges();
      settleLocalDraft();
      collection.remount();
    } catch {
      // The library owns and displays its failed load.
    }
  }
  function retryLoad() {
    void library.load().catch(() => undefined);
  }
  function settleLocalDraft() {
    clearMusicDraftRecovery();
    setRecoveryError('');
  }
  function retainLocalDraft(catalog: MusicCatalog, revisionId: string | null) {
    publication.clearPublication();
    if (!rememberMusicDraft(catalog, revisionId))
      setRecoveryError(
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
          error={draft.state.error}
          blocked={currentDraft.blocked}
          conflict={draft.state.conflict}
          reconnect={Boolean(library.connection?.reconnect)}
          onRetry={draft.retry}
          onUseSaved={loadSavedDraft}
          onConnect={library.connect}
          onDismiss={draft.dismissError}
        />
        <MusicOperationNotice
          error={library.loadError}
          onDismiss={library.dismissLoadError}
        >
          <button className="mp-button mp-tonal" onClick={retryLoad}>
            Try again
          </button>
        </MusicOperationNotice>
        <MusicOperationNotice
          error={library.connectError}
          onDismiss={library.dismissConnectError}
        />
        <MusicOperationNotice
          error={library.refreshError}
          onDismiss={library.dismissRefreshError}
        >
          {library.connection?.reconnect && (
            <button
              className="mp-button"
              onClick={() => void library.connect()}
            >
              Reconnect Spotify
            </button>
          )}
        </MusicOperationNotice>
        <MusicOperationNotice
          error={history.error}
          onDismiss={history.dismissError}
        />
        <MusicOperationNotice
          error={publication.error}
          onDismiss={publication.dismissError}
        />
        <MusicOperationNotice
          error={callbackError}
          onDismiss={() => setCallbackError('')}
        />
        <MusicOperationNotice
          error={recoveryError}
          onDismiss={() => setRecoveryError('')}
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
        loadError={library.loadError}
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
