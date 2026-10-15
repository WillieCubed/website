'use client';
import { useState } from 'react';

import type {
  MusicAdminCollectionData,
  MusicConnection,
  MusicPublication,
  MusicRevision,
} from '@/lib/music/types';
import { emptyCatalog } from '@/lib/music/types';

import {
  type MusicRevisionResponse,
  musicAdminRequest,
} from './music-admin-request';
import { type MusicDraftSnapshot, canRefreshMusic } from './music-draft-guards';
import { importMusicLibrary } from './music-library-import';

interface SpotifyConnectionRedirect {
  url: string;
}

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
  setStatus: (message: string) => void;
}
export function useMusicLibrary({
  acceptCollection,
  acceptImportedRevision,
  acceptPublication,
  readDraft,
  remount,
  setBusy,
  setStatus,
}: Options) {
  const [loadError, setLoadError] = useState('');
  const [connectError, setConnectError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [connection, setConnection] = useState<MusicConnection | null>(null);
  async function load() {
    setLoadError('');
    try {
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
    } catch (error) {
      setLoadError((error as Error).message);
      throw error;
    }
  }
  async function connect() {
    setBusy(true);
    setConnectError('');
    try {
      const result = await musicAdminRequest<SpotifyConnectionRedirect>(
        '/spotify/connect',
        {
          method: 'POST',
        }
      );
      location.assign(result.url);
    } catch (e) {
      setConnectError((e as Error).message);
      setBusy(false);
    }
  }
  async function refresh() {
    if (!canRefreshMusic(readDraft())) {
      setRefreshError('Wait for the draft to save before refreshing.');
      return;
    }
    setBusy(true);
    setRefreshError('');
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
        const next = await musicAdminRequest<MusicRevisionResponse>(
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
      if (imported.failed > 0)
        setRefreshError(
          `${imported.failed} playlists could not refresh. Saved choices are intact. Retry the refresh.`
        );
      setStatus('Saved privately');
    } catch (e) {
      setRefreshError((e as Error).message);
      setStatus('Refresh needs attention');
    } finally {
      setBusy(false);
    }
  }
  return {
    connection,
    load,
    connect,
    refresh,
    loadError,
    connectError,
    refreshError,
    dismissLoadError: () => setLoadError(''),
    dismissConnectError: () => setConnectError(''),
    dismissRefreshError: () => setRefreshError(''),
  };
}
