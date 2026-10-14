'use client';
import { useEffect, useRef, useState } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import type {
  MusicCatalog,
  MusicPlaylist,
  MusicPublication,
  MusicRevision,
} from '@/lib/music/types';
import { emptyCatalog } from '@/lib/music/types';

import MusicExperience from './MusicExperience';

const recoveryKey = 'willie-music-recovery-v1';
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/studio/music${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json'))
    throw new Error(
      'The preview returned a page instead of music data. Reload your collection and try again.'
    );
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(data.error ?? 'The request failed. Try again.'),
      { status: response.status, details: data.details }
    );
  return data;
}
interface Connection {
  connected: boolean;
  configured: boolean;
  reconnect: boolean;
  ownerId: string | null;
  import?: {
    total: number;
    done: number;
    failed: number;
    running: boolean;
    updatedAt: string;
  } | null;
}
export default function MusicAdmin() {
  const [data, setData] = useState<{
    revision: MusicRevision | null;
    playlists: MusicPlaylist[];
  } | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [status, setStatus] = useState('Loading your collection…');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publication, setPublication] = useState<MusicPublication | null>(null);
  const [showPublicationNotice, setShowPublicationNotice] = useState(false);
  const [history, setHistory] = useState<MusicRevision[] | null>(null);
  const [recovery, setRecovery] = useState<{
    catalog: MusicCatalog;
    base: string | null;
  } | null>(null);
  const [generation, setGeneration] = useState(0);
  const pollFailures = useRef(0);
  const historyDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (history) historyDialog.current?.showModal();
    else historyDialog.current?.close();
  }, [history]);
  const base = useRef<string | null>(null),
    pending = useRef<MusicCatalog | null>(null),
    saved = useRef<MusicCatalog>(emptyCatalog),
    savingRef = useRef(false),
    blocked = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function load() {
    const [catalog, conn] = await Promise.all([
      request<{
        revision: MusicRevision | null;
        playlists: MusicPlaylist[];
        publication?: MusicPublication | null;
      }>('/catalog'),
      request<Connection>('/connection'),
    ]);
    base.current = catalog.revision?.id ?? null;
    saved.current = catalog.revision?.body ?? {
      ...emptyCatalog,
      order: catalog.playlists.map((p) => p.id),
    };
    setData(catalog);
    setPublication(catalog.publication ?? null);
    setShowPublicationNotice(
      Boolean(catalog.publication && catalog.publication.status !== 'live')
    );
    setConnection(conn);
    setStatus(
      catalog.revision
        ? 'Saved privately'
        : 'Choose what belongs in your gallery'
    );
    return { catalog, conn };
  }
  useEffect(() => {
    let active = true;
    load()
      .then(async ({ catalog, conn }) => {
        if (!active) return;
        const params = new URLSearchParams(location.search);
        if (params.get('connectionError'))
          setError(params.get('connectionError')!);
        try {
          const local = JSON.parse(localStorage.getItem(recoveryKey) ?? 'null');
          if (
            local?.catalog &&
            JSON.stringify(local.catalog) !==
              JSON.stringify(catalog.revision?.body)
          )
            setRecovery(local);
        } catch {
          /* Server draft remains available when local storage is blocked. */
        }
        if (params.has('connected') && conn.connected) {
          window.history.replaceState(null, '', location.pathname);
          await refresh();
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  async function drain() {
    if (savingRef.current || blocked.current) return;
    savingRef.current = true;
    setSaving(true);
    let inFlight: MusicCatalog | null = null;
    try {
      while (pending.current) {
        const body = pending.current;
        inFlight = body;
        pending.current = null;
        const result = await request<{ revision: MusicRevision }>('/catalog', {
          method: 'PUT',
          body: JSON.stringify({
            expectedRevisionId: base.current,
            catalog: body,
          }),
        });
        base.current = result.revision.id;
        saved.current = result.revision.body;
        setData((old) => (old ? { ...old, revision: result.revision } : old));
        if (!pending.current) {
          try {
            localStorage.removeItem(recoveryKey);
          } catch {
            /* Local recovery is optional; the server revision remains intact. */
          }
        }
      }
      setStatus('Saved privately');
      setError('');
    } catch (e) {
      blocked.current = true;
      pending.current ??= inFlight;
      setConflict((e as { status?: number }).status === 409);
      setError((e as Error).message);
      setStatus('Draft needs attention');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  async function retrySave() {
    try {
      if (conflict) {
        const latest = await request<{ revision: MusicRevision | null }>(
          '/catalog'
        );
        base.current = latest.revision?.id ?? null;
      }
      blocked.current = false;
      setConflict(false);
      await drain();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function useSaved() {
    try {
      await load();
      pending.current = null;
      blocked.current = false;
      setConflict(false);
      setError('');
      setSaving(false);
      try {
        localStorage.removeItem(recoveryKey);
      } catch {
        /* Server data remains available. */
      }
      setGeneration((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function change(catalog: MusicCatalog) {
    if (busy) return;
    pending.current = catalog;
    setStatus('Saving…');
    setSaving(true);
    setPublication(null);
    try {
      localStorage.setItem(
        recoveryKey,
        JSON.stringify({ base: base.current, catalog })
      );
    } catch {
      setError(
        'Browser recovery is unavailable. Keep this tab open until the save finishes.'
      );
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void drain(), 650);
  }
  async function connect() {
    setBusy(true);
    setError('');
    try {
      const result = await request<{ url: string }>('/spotify/connect', {
        method: 'POST',
      });
      location.assign(result.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function refresh() {
    if (savingRef.current || pending.current) {
      setError('Wait for your draft to save before refreshing.');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('Importing your Spotify playlists…');
    try {
      const started = Date.now();
      let imported: { failed: number };
      try {
        imported = await request<{ failed: number }>('/import', {
          method: 'POST',
        });
      } catch (error) {
        // The edge may lose a long import's response after the server has
        // saved its progress. Check that this specific run finished before
        // treating the missing response as a failed import.
        const latest = await request<Connection>('/connection');
        const progress = latest.import;
        const finishedAt = Date.parse(progress?.updatedAt ?? '');
        if (
          (error as { status?: number }).status ||
          !progress ||
          progress.running ||
          !Number.isFinite(finishedAt) ||
          finishedAt < started ||
          progress.done + progress.failed < progress.total
        )
          throw error;
        imported = progress;
      }
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
        const next = await request<{ revision: MusicRevision }>('/catalog', {
          method: 'PUT',
          body: JSON.stringify({
            expectedRevisionId: base.current,
            catalog: { ...body, order },
          }),
        });
        base.current = next.revision.id;
        saved.current = next.revision.body;
        setData({ ...result.catalog, revision: next.revision });
      }
      setGeneration((n) => n + 1);
      if (imported.failed)
        setError(
          `${imported.failed} playlists could not refresh. Your saved choices are intact. Retry the refresh.`
        );
      setStatus('Saved privately');
    } catch (e) {
      setError((e as Error).message);
      setStatus('Refresh needs attention');
    } finally {
      setBusy(false);
    }
  }
  async function publish(reviewed: MusicCatalog) {
    if (
      !base.current ||
      savingRef.current ||
      pending.current ||
      blocked.current ||
      busy
    )
      return;
    if (JSON.stringify(reviewed) !== JSON.stringify(saved.current)) {
      setError(
        'Your draft changed after review. Review the saved version again.'
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await request<MusicPublication>('/publications', {
        method: 'POST',
        body: JSON.stringify({ revisionId: base.current }),
      });
      setPublication(result);
      setShowPublicationNotice(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (
      !publication ||
      !['publishing', 'deploying'].includes(publication.status)
    )
      return;
    const timer = setTimeout(
      () => {
        request<MusicPublication>(`/publications/${publication.id}`)
          .then((result) => {
            pollFailures.current = 0;
            setError('');
            setPublication(result);
          })
          .catch((e) => {
            pollFailures.current++;
            setError(e.message);
            setPublication((current) => (current ? { ...current } : null));
          });
      },
      Math.min(60000, 5000 * 2 ** pollFailures.current)
    );
    return () => clearTimeout(timer);
  }, [publication]);
  async function restore(revisionId: string) {
    if (savingRef.current || pending.current || blocked.current) {
      setError('Wait for your draft to save before restoring history.');
      return;
    }
    setBusy(true);
    try {
      await request('/history', {
        method: 'POST',
        body: JSON.stringify({ revisionId, expectedRevisionId: base.current }),
      });
      blocked.current = false;
      pending.current = null;
      await load();
      setGeneration((n) => n + 1);
      setHistory(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const initial = data?.revision?.body ?? {
    ...emptyCatalog,
    order: data?.playlists.map((p) => p.id) ?? [],
  };
  const eligible = data?.playlists.filter((p) => p.eligible) ?? [];
  return (
    <>
      <div className="music-admin-notices">
        {error && (
          <div className="music-admin-notice" role="alert">
            <p>{error}</p>
            <div className="music-admin-notice__actions">
              {blocked.current && (
                <button
                  className="mp-button mp-tonal"
                  onClick={() => void retrySave()}
                >
                  {conflict ? 'Save my version' : 'Retry save'}
                </button>
              )}
              {conflict && (
                <button
                  className="mp-button mp-tonal"
                  onClick={() => void useSaved()}
                >
                  Use current saved draft
                </button>
              )}
              {connection?.reconnect && (
                <button className="mp-button" onClick={() => void connect()}>
                  Reconnect Spotify
                </button>
              )}
              {!blocked.current && !connection?.reconnect && (
                <button
                  className="music-admin-notice__close"
                  aria-label="Dismiss message"
                  onClick={() => setError('')}
                >
                  <Icon name="x" size={18} />
                </button>
              )}
            </div>
          </div>
        )}
        {busy && (
          <p role="status">
            {status === 'Importing your Spotify playlists…'
              ? status
              : 'Working…'}
          </p>
        )}
        {recovery && (
          <div className="music-admin-notice" role="status">
            <p>This browser has an unsaved draft.</p>
            <div className="music-admin-notice__actions">
              <button
                className="mp-button"
                onClick={() => {
                  setData((old) =>
                    old
                      ? {
                          ...old,
                          revision: {
                            id: base.current ?? '',
                            body: recovery.catalog,
                            conflict: false,
                            createdAt: new Date().toISOString(),
                          },
                        }
                      : old
                  );
                  setGeneration((n) => n + 1);
                  change(recovery.catalog);
                  setRecovery(null);
                }}
              >
                Recover draft
              </button>
              <button
                className="mp-button mp-tonal"
                onClick={() => {
                  localStorage.removeItem(recoveryKey);
                  setRecovery(null);
                }}
              >
                Use saved draft
              </button>
            </div>
          </div>
        )}
        {publication && showPublicationNotice && (
          <div className="music-admin-notice" role="status">
            <p>
              {publication.status === 'live'
                ? 'Your collection is live.'
                : publication.status === 'deploying'
                  ? 'Deploying your collection…'
                  : publication.status === 'publishing'
                    ? 'Publishing your reviewed collection…'
                    : (publication.error ?? 'Publication failed.')}
            </p>
            <div className="music-admin-notice__actions">
              {publication.status === 'failed' && (
                <button
                  className="mp-button"
                  onClick={() => void publish(saved.current)}
                >
                  Retry publication
                </button>
              )}
              {publication.pullRequestUrl && publication.status !== 'live' && (
                <SiteLink
                  href={publication.pullRequestUrl}
                  target="_blank"
                  preview={false}
                >
                  View publication
                </SiteLink>
              )}
              {publication.status === 'live' && (
                <SiteLink href="https://willie.page/music" preview={false}>
                  View gallery
                </SiteLink>
              )}
              {publication.status !== 'publishing' &&
                publication.status !== 'deploying' && (
                  <button
                    className="music-admin-notice__close"
                    aria-label="Dismiss publication message"
                    onClick={() => setShowPublicationNotice(false)}
                  >
                    <Icon name="x" size={18} />
                  </button>
                )}
            </div>
          </div>
        )}
      </div>
      {data && connection ? (
        <MusicExperience
          key={generation}
          mode="admin"
          playlists={data.playlists}
          initialCatalog={initial}
          onChange={change}
          onPublish={publish}
          interactionLocked={busy}
          canReview={
            !saving && !busy && !blocked.current && Boolean(base.current)
          }
          saveStatus={status}
          published={
            publication?.status === 'live' &&
            publication.revisionId === data.revision?.id &&
            !pending.current &&
            !saving
          }
          connected={connection.connected}
          onConnect={connect}
          onRefresh={refresh}
          setupInitially={
            !data.revision || (!initial.selected.length && eligible.length > 0)
          }
          adminMenuItems={[
            {
              label: 'History',
              onSelect: () => {
                void request<{ revisions: MusicRevision[] }>('/history')
                  .then((r) => setHistory(r.revisions))
                  .catch((e) => setError(e.message));
              },
            },
            ...(!connection.connected
              ? [{ label: 'Reconnect Spotify', onSelect: () => void connect() }]
              : []),
          ]}
        />
      ) : (
        <main id="main" className="mp-shell">
          <h1>Music</h1>
          <p>{status}</p>
          {error && <button onClick={() => void load()}>Try again</button>}
        </main>
      )}
      {history && (
        <dialog
          ref={historyDialog}
          className="music-history"
          onCancel={() => setHistory(null)}
          onClose={() => setHistory(null)}
          aria-labelledby="music-history-title"
        >
          <div>
            <h2 id="music-history-title">Saved revisions</h2>
            <button
              className="mp-button mp-tonal"
              onClick={() => setHistory(null)}
            >
              Close history
            </button>
            <ol>
              {history.map((r) => (
                <li key={r.id}>
                  <span>
                    {new Date(r.createdAt).toLocaleString()} ·{' '}
                    {r.body.selected.length} playlists
                    {r.conflict ? ' · Conflict copy' : ''}
                  </span>
                  <button
                    className="mp-button"
                    disabled={busy || r.id === base.current}
                    onClick={() => void restore(r.id)}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </dialog>
      )}
    </>
  );
}
