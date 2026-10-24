import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { readFileSync } from '../content/runtime-files';
import { type PostgresPool, createPool } from '../db/postgres';
import { HttpError } from '../http/errors';
import { optionalWithin } from '../http/optional';
import { isPrivatePreview } from '../studio/config';
import { visibleCollection } from './public-projection';
import { parseCatalog, publicCatalog } from './schema';
import { musicStore } from './store';
import type { MusicPlaylist } from './types';

let pool: PostgresPool | undefined;
let writer: PostgresPool | undefined;
function musicDatabaseUrl(name: string) {
  const url = process.env[name];
  if (!url) throw new Error(`${name} is not configured.`);
  return url;
}
function cacheWriter() {
  if (!process.env.MUSIC_CACHE_WRITE_DATABASE_URL)
    throw new HttpError(503, 'Music publication storage is not configured.');
  return (writer ??= createPool({
    connectionString: musicDatabaseUrl('MUSIC_CACHE_WRITE_DATABASE_URL'),
    max: 2,
  }));
}
export function publicMusicPool() {
  return (pool ??= createPool({
    connectionString: musicDatabaseUrl('MUSIC_PUBLIC_DATABASE_URL'),
    max: 2,
  }));
}
export async function approvedManifest() {
  const source = readFileSync(
    join(process.cwd(), 'content/music/catalog.json'),
    'utf8'
  );
  const value = JSON.parse(source);
  const catalog = parseCatalog(value.catalog);
  if (JSON.stringify(publicCatalog(catalog)) !== JSON.stringify(catalog))
    throw new Error('Public catalog contains private records.');
  return {
    revisionId: value.revisionId as string | null,
    catalog,
    sourceSha: createHash('sha1')
      .update(`blob ${Buffer.byteLength(source)}\0`)
      .update(source)
      .digest('hex'),
    commit: process.env.NEXT_PUBLIC_SITE_REVISION ?? null,
  };
}
export async function publicCollection() {
  const manifest = await approvedManifest();
  if (manifest.catalog.selected.length === 0)
    return { ...manifest, playlists: [] };
  const rows = await optionalWithin(
    Promise.resolve().then(() =>
      publicMusicPool().query(
        'SELECT body, eligible, checked_at FROM music_approved_cache WHERE id=ANY($1::text[])',
        [manifest.catalog.selected]
      )
    ),
    null,
    3000
  );
  const collection = visibleCollection(
    manifest.catalog,
    rows?.rows.map((r) => {
      const body = r.body as MusicPlaylist;
      const checkedAt = new Date(r.checked_at).toISOString();
      return {
        ...body,
        eligible: r.eligible && body.eligible,
        // Honor both cache timestamps; neither may extend the other’s life.
        checkedAt:
          Date.parse(checkedAt) < Date.parse(body.checkedAt)
            ? checkedAt
            : body.checkedAt,
      };
    }) ?? []
  );
  return {
    ...manifest,
    ...collection,
    unavailable: rows === null || collection.unavailable,
  };
}
export async function cacheApproved(playlists: MusicPlaylist[]) {
  // The owner preview already has a private Music database connection. It
  // writes approved rows there; the public Worker keeps its scoped role.
  const pool = isPrivatePreview() ? musicStore().pool : cacheWriter();
  for (const p of playlists)
    await pool.query(
      'INSERT INTO music_approved_cache(id,body,checked_at,eligible) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET body=excluded.body,checked_at=excluded.checked_at,eligible=excluded.eligible',
      [p.id, JSON.stringify(p), p.checkedAt, p.eligible]
    );
}

export async function suppressApproved(id: string) {
  const pool = isPrivatePreview() ? musicStore().pool : cacheWriter();
  await pool.query(
    'UPDATE music_approved_cache SET eligible=false WHERE id=$1',
    [id]
  );
}
