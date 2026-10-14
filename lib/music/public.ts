import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { readFileSync } from '../content/runtime-files';
import { createPool } from '../db/postgres';
import { isPrivatePreview } from '../studio/config';
import { StudioError } from '../studio/errors';
import { visibleCollection } from './public-projection';
import { parseCatalog, publicCatalog } from './schema';
import { musicStore } from './store';
import type { MusicPlaylist } from './types';

let pool: ReturnType<typeof createPool> | undefined;
let writer: ReturnType<typeof createPool> | undefined;
function musicDatabaseUrl(name: string) {
  const url = process.env[name];
  if (!url) throw new Error(`${name} is not configured.`);
  return url;
}
function cacheWriter() {
  if (!process.env.MUSIC_CACHE_WRITE_DATABASE_URL)
    throw new StudioError(503, 'Music publication storage is not configured.');
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
  if (!manifest.catalog.selected.length) return { ...manifest, playlists: [] };
  const rows = await publicMusicPool().query(
    "SELECT body FROM music_approved_cache WHERE id=ANY($1::text[]) AND eligible=true AND checked_at>now()-interval '24 hours'",
    [manifest.catalog.selected]
  );
  return {
    ...manifest,
    ...visibleCollection(
      manifest.catalog,
      rows.rows.map((r) => r.body as MusicPlaylist)
    ),
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
