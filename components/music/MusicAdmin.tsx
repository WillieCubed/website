'use client';
import { useState } from 'react';

import SiteLink from '@/components/link/SiteLink';
import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';

import type {
  MusicAdminCollectionData,
  MusicPublication,
} from '@/lib/music/types';

import MusicAdminExperience from './MusicAdminExperience';
import {
  MusicLibraryNotices,
  MusicOperationErrors,
  MusicPublicationNotice,
  MusicRecoveryNotice,
  MusicSaveNotice,
} from './MusicAdminNotices';
import MusicRevisionHistory from './MusicRevisionHistory';
import { adminCollectionView } from './music-admin-collection';
import { canPublishMusic } from './music-draft-guards';
import './styles/admin.css';
import { useMusicAdminDraft } from './useMusicAdminDraft';
import { useMusicInitialLoad } from './useMusicInitialLoad';
import { useMusicLibrary } from './useMusicLibrary';
import { useMusicPublication } from './useMusicPublication';
import { useMusicRevisionHistory } from './useMusicRevisionHistory';

export default function MusicAdmin() {
  const [status, setStatus] = useState('Loading playlists…');
  const [busy, setBusy] = useState(false);
  const {
    collection,
    loadSavedDraft,
    reloadRestored,
    draft,
    recovery,
    retention,
    acceptCollection,
    acceptImportedRevision,
  } = useMusicAdminDraft({
    busy,
    setStatus,
    onStaged: () => publication.clearPublication(),
  });
  const publication = useMusicPublication({
    readDraft: draft.inspect,
    busy,
    setBusy,
  });

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
    onRestored: () => reloadRestored(library.load),
    setBusy,
  });
  const callback = useMusicInitialLoad({
    load: library.load,
    refresh: library.refresh,
    discover: recovery.discover,
  });
  function retryLoad() {
    void library.load().catch(() => undefined);
  }
  const currentDraft = draft.inspect();
  const { playlists, initialCatalog, loading, connected, setupInitially } =
    adminCollectionView(
      collection.data,
      library.connection,
      collection.editorCatalog
    );
  const canReview = !draft.state.saving && canPublishMusic(currentDraft, busy);
  const published = isPublishedDraft(
    publication.publication,
    collection.data,
    currentDraft.pending,
    draft.state.saving
  );
  const adminMenuItems = musicAdminMenu(
    connected,
    history.openHistory,
    library.connect
  );
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
          onUseSaved={() => loadSavedDraft(library.load)}
          onConnect={library.connect}
          onDismiss={draft.dismissError}
        />
        <MusicLibraryNotices
          loadError={library.loadError}
          connectError={library.connectError}
          refreshError={library.refreshError}
          onDismissLoad={library.dismissLoadError}
          onDismissConnect={library.dismissConnectError}
          onDismissRefresh={library.dismissRefreshError}
          reconnect={Boolean(library.connection?.reconnect)}
          onRetry={retryLoad}
          onConnect={library.connect}
        />
        <MusicOperationErrors
          notices={[
            { error: history.error, onDismiss: history.dismissError },
            { error: publication.error, onDismiss: publication.dismissError },
            { error: callback.error, onDismiss: callback.dismiss },
            { error: retention.error, onDismiss: retention.dismiss },
          ]}
        />
        {busy && (
          <p className="sr-only" role="status">
            {status === 'Importing Spotify playlists…' ? status : 'Working…'}
          </p>
        )}
        <MusicRecoveryNotice
          available={recovery.available}
          disabled={busy}
          onRecover={recovery.recover}
          onDiscard={recovery.discard}
        />
        <MusicPublicationNotice
          publication={publication.publication}
          visible={publication.showPublicationNotice}
          onRetry={() => publication.publish(draft.inspect().savedCatalog)}
          onDismiss={publication.dismissNotice}
        />
      </div>
      <MusicAdminExperience
        key={collection.generation}
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

function musicAdminMenu(
  connected: boolean,
  openHistory: () => void,
  connect: () => Promise<void>
): BreadcrumbMenuItem[] {
  return [
    { label: 'History', onSelect: openHistory },
    ...(!connected
      ? [{ label: 'Reconnect Spotify', onSelect: () => void connect() }]
      : []),
  ];
}
