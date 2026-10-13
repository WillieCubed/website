import { createHash, timingSafeEqual } from 'node:crypto';

import { StudioError } from '../studio/errors';
import { approvedManifest, cacheApproved } from './public';
import { SpotifyClient, SpotifyError } from './spotify/client';
import { importPlaylist } from './spotify/import';
import { accessToken } from './spotify/tokens';
import { musicStore } from './store';

export function authorizeRefresh(
  request: Request,
  secret = process.env.MUSIC_REFRESH_SECRET
) {
  if (!secret || secret.length < 32)
    throw new StudioError(503, 'Refresh is not configured.');
  const actual = request.headers.get('authorization') ?? '';
  if (
    !timingSafeEqual(
      createHash('sha256').update(actual).digest(),
      createHash('sha256').update(`Bearer ${secret}`).digest()
    )
  )
    throw new StudioError(401, 'Unauthorized');
}
export async function refreshApproved() {
  const manifest = await approvedManifest();
  if (!manifest.catalog.selected.length)
    return { checked: 0, failed: 0, suppressed: 0 };
  const store = musicStore(),
    db = await store.pool.connect();
  const locked = (
    await db.query(
      "SELECT pg_try_advisory_lock(hashtext('music-refresh')) AS locked"
    )
  ).rows[0].locked;
  if (!locked) {
    db.release();
    throw new StudioError(409, 'Refresh is already running.');
  }
  try {
    const auth = await accessToken(),
      client = new SpotifyClient(auth.token),
      previous = await store.playlists();
    let checked = 0,
      failed = 0,
      suppressed = 0;
    const deadline = Date.now() + 240000;
    for (const id of manifest.catalog.selected) {
      if (Date.now() > deadline) {
        failed += manifest.catalog.selected.length - checked - failed;
        break;
      }
      try {
        const p = await importPlaylist(
          client,
          id,
          auth.ownerId,
          previous.find((p) => p.id === id)
        );
        await store.cache(p);
        await cacheApproved([p]);
        checked++;
        if (!p.eligible) suppressed++;
      } catch (error) {
        failed++;
        if (
          error instanceof SpotifyError &&
          [401, 429].includes(error.providerStatus)
        )
          throw error;
      }
    }
    return { checked, failed, suppressed };
  } finally {
    await db.query("SELECT pg_advisory_unlock(hashtext('music-refresh'))");
    db.release();
  }
}
