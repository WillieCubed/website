import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

import { visibleCollection } from './public-projection';
import { parseCatalog, publicCatalog } from './schema';
import type { MusicPlaylist } from './types';

let pool: Pool | undefined;
let writer: Pool | undefined;
function cacheWriter() {
  return (writer ??= new Pool({
    connectionString:
      process.env.MUSIC_CACHE_WRITE_DATABASE_URL ??
      process.env.MUSIC_PUBLIC_DATABASE_URL ??
      process.env.POSTGRES_URL,
    max: 2,
  }));
}
export function publicMusicPool() {
  const connectionString =
    process.env.MUSIC_PUBLIC_DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!connectionString)
    throw new Error('Public music cache is not configured.');
  return (pool ??= new Pool({ connectionString, max: 2 }));
}
export async function approvedManifest() {
  const source = await readFile(
    new URL(`file://${process.cwd()}/content/music/catalog.json`),
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
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
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
  for (const p of playlists)
    await cacheWriter().query(
      'INSERT INTO music_approved_cache(id,body,checked_at,eligible) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET body=excluded.body,checked_at=excluded.checked_at,eligible=excluded.eligible',
      [p.id, JSON.stringify(p), p.checkedAt, p.eligible]
    );
}

export async function suppressApproved(id: string) {
  await cacheWriter().query(
    'UPDATE music_approved_cache SET eligible=false WHERE id=$1',
    [id]
  );
}
