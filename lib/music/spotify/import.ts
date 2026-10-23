import { HttpError } from '../../http/errors';
import { suppressApproved } from '../public';
import { musicStore } from '../store';
import type { MusicPlaylist } from '../types';
import { SpotifyClient, SpotifyError } from './client';
import { normalizePlaylist, normalizeTrack } from './normalize';
import { accessToken } from './tokens';

async function playlistMetadata(
  client: SpotifyClient,
  id: string,
  previous?: MusicPlaylist
) {
  try {
    return {
      kind: 'available' as const,
      metadata: await client.get(`playlists/${id}`),
    };
  } catch (error) {
    if (
      error instanceof SpotifyError &&
      [403, 404].includes(error.providerStatus) &&
      previous
    )
      return { kind: 'unavailable' as const };
    throw error;
  }
}
function unavailablePlaylist(previous: MusicPlaylist): MusicPlaylist {
  return {
    ...previous,
    eligible: false,
    checkedAt: new Date().toISOString(),
    error: 'This playlist is no longer available.',
  };
}

export async function importPlaylist(
  client: SpotifyClient,
  id: string,
  owner: string,
  previous?: MusicPlaylist
): Promise<MusicPlaylist> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await playlistMetadata(client, id, previous);
    if (result.kind === 'unavailable') return unavailablePlaylist(previous!);
    const raw = result.metadata;
    const normalized = normalizePlaylist(
      raw,
      owner,
      [],
      new Date().toISOString()
    );
    if (!normalized.eligible) return normalized;
    if (
      previous?.snapshot === normalized.snapshot &&
      previous.tracks.length === normalized.trackCount
    )
      return { ...normalized, tracks: previous.tracks };
    const items = await client.pages(`playlists/${id}/items?limit=100`);
    const after = await client.get(`playlists/${id}`);
    if (after.snapshot_id !== raw.snapshot_id) continue;
    return normalizePlaylist(
      after,
      owner,
      items.map(normalizeTrack),
      new Date().toISOString()
    );
  }
  throw new HttpError(
    409,
    'The playlist changed during import. Retry to load one complete sequence.'
  );
}
export async function importLibrary() {
  const store = musicStore(),
    db = await store.pool.connect();
  const locked = (
    await db.query(
      "SELECT pg_try_advisory_lock(hashtext('music-import')) AS locked"
    )
  ).rows[0].locked;
  if (!locked) {
    await db.release();
    throw new HttpError(409, 'A library refresh is already running.');
  }
  const progress = {
    total: 0,
    done: 0,
    failed: 0,
    running: true,
    retryAfter: null as number | null,
    updatedAt: new Date().toISOString(),
  };
  const saveProgress = () =>
    store.pool.query(
      'INSERT INTO music_import_state VALUES(true,$1) ON CONFLICT(singleton) DO UPDATE SET body=excluded.body',
      [JSON.stringify({ ...progress, updatedAt: new Date().toISOString() })]
    );
  const cache = async (p: MusicPlaylist) => {
    await store.cache(p);
    if (!p.eligible) await suppressApproved(p.id);
  };
  try {
    await saveProgress();
    const { token, ownerId } = await accessToken(),
      client = new SpotifyClient(token),
      previous = await store.playlists();
    const list = await client.pages<{ id: string; owner?: { id?: string } }>(
      'me/playlists?limit=50'
    );
    const owned = list.filter((p) => p?.owner?.id === ownerId),
      seen = new Set(owned.map((p) => p.id));
    // An incomplete listing cannot establish that an old playlist disappeared.
    for (const old of previous.filter((p) => !seen.has(p.id)))
      await cache({
        ...old,
        eligible: false,
        checkedAt: new Date().toISOString(),
        error: 'This playlist is no longer in your library.',
      });
    progress.total = owned.length;
    let index = 0;
    let pause: SpotifyError | null = null;
    const deadline = Date.now() + 240000;
    const work = async () => {
      while (index < owned.length && !pause && Date.now() < deadline) {
        const item = owned[index++];
        try {
          await cache(
            await importPlaylist(
              client,
              item.id,
              ownerId,
              previous.find((p) => p.id === item.id)
            )
          );
          progress.done++;
        } catch (error) {
          if (
            error instanceof SpotifyError &&
            [401, 429].includes(error.providerStatus)
          )
            pause = error;
          progress.failed++;
        }
        await saveProgress();
      }
    };
    await Promise.all([work(), work()]);
    if (pause !== null) {
      progress.retryAfter = (pause as SpotifyError).retryAfter;
      if ((pause as SpotifyError).providerStatus === 401)
        await store.pool.query(
          'UPDATE music_connections SET reconnect=true WHERE singleton=true'
        );
      throw pause;
    }
    progress.failed += owned.length - index;
    return { ...progress, running: false };
  } finally {
    progress.running = false;
    try {
      await saveProgress();
    } finally {
      await db.query("SELECT pg_advisory_unlock(hashtext('music-import'))");
      await db.release();
    }
  }
}
