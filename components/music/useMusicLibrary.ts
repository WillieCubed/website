'use client';
import { useState } from 'react';

import type {
  MusicAdminCollectionData,
  MusicConnection,
  MusicPublication,
  MusicRevision,
} from '@/lib/music/types';
import { emptyCatalog } from '@/lib/music/types';

import { musicAdminRequest } from './music-admin-request';
import { type MusicDraftSnapshot, canRefreshMusic } from './music-draft-guards';
import { importMusicLibrary } from './music-library-import';

interface Options {
  acceptCollection: (catalog: MusicAdminCollectionData) => void;
  acceptImportedRevision: (
    revision: MusicRevision,
    catalog: MusicAdminCollectionData
  ) => void;
  acceptPublication: (publication: MusicPublication | null) => void;
  readDraft: () => MusicDraftSnapshot;
  remount: () => void;
  setBusy: (busy: boolean) => void;
  setError: (message: string) => void;
  setStatus: (message: string) => void;
}
export function useMusicLibrary({
  acceptCollection,
  acceptImportedRevision,
  acceptPublication,
  readDraft,
  remount,
  setBusy,
  setError,
  setStatus,
}: Options) {
  const [connection, setConnection] = useState<MusicConnection | null>(null);
  async function load() {
    const [catalog, conn] = await Promise.all([
      musicAdminRequest<MusicAdminCollectionData>('/catalog'),
      musicAdminRequest<MusicConnection>('/connection'),
    ]);
    acceptCollection(catalog);
    acceptPublication(catalog.publication ?? null);
    setConnection(conn);
    setStatus(
      catalog.revision
        ? 'Saved privately'
        : 'Choose what belongs in the public gallery'
    );
    return { catalog, conn };
  }
  async function connect() {
    setBusy(true);
    setError('');
    try {
      const result = await musicAdminRequest<{ url: string }>(
        '/spotify/connect',
        {
          method: 'POST',
        }
      );
      location.assign(result.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function refresh() {
    if (!canRefreshMusic(readDraft())) {
      setError('Wait for the draft to save before refreshing.');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('Importing Spotify playlists…');
    try {
      const imported = await importMusicLibrary();
      const result = await load();
      const body = result.catalog.revision?.body ?? emptyCatalog;
      const order = [
        ...body.order,
        ...result.catalog.playlists
          .map((p) => p.id)
          .filter((id) => !body.order.includes(id)),
      ];
      if (
        JSON.stringify(order) !== JSON.stringify(body.order) ||
        !result.catalog.revision
      ) {
        const next = await musicAdminRequest<{ revision: MusicRevision }>(
          '/catalog',
          {
            method: 'PUT',
            body: JSON.stringify({
              expectedRevisionId: result.catalog.revision?.id ?? null,
              catalog: { ...body, order },
            }),
          }
        );
        acceptImportedRevision(next.revision, result.catalog);
      }
      remount();
      if (imported.failed)
        setError(
          `${imported.failed} playlists could not refresh. Saved choices are intact. Retry the refresh.`
        );
      setStatus('Saved privately');
    } catch (e) {
      setError((e as Error).message);
      setStatus('Refresh needs attention');
    } finally {
      setBusy(false);
    }
  }
  return { connection, load, connect, refresh };
}
