import { randomUUID } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';

import { createPool } from '../db/postgres';
import { StudioError } from '../studio/errors';
import { parseCatalog } from './schema';
import type { MusicCatalog, MusicPlaylist, MusicRevision } from './types';

interface MusicClient {
  query<T extends QueryResultRow = any>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>>;
  release(): void | Promise<void>;
}

interface MusicPool {
  query<T extends QueryResultRow = any>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>>;
  connect(): Promise<MusicClient>;
}

function revision(row: Record<string, unknown>): MusicRevision {
  return {
    id: String(row.id),
    body: row.body as MusicCatalog,
    createdAt: new Date(String(row.created_at)).toISOString(),
    conflict: Boolean(row.conflict),
  };
}
export class MusicStore {
  constructor(readonly pool: MusicPool) {}
  async head(): Promise<MusicRevision | null> {
    const result = await this.pool.query(
      'SELECT r.* FROM music_catalog_head h JOIN music_revisions r ON r.id=h.revision_id WHERE h.singleton=true'
    );
    return result.rows[0] ? revision(result.rows[0]) : null;
  }
  async revision(id: string) {
    const r = await this.pool.query(
      'SELECT * FROM music_revisions WHERE id=$1',
      [id]
    );
    return r.rows[0] ? revision(r.rows[0]) : null;
  }
  async history() {
    return (
      await this.pool.query(
        'SELECT * FROM music_revisions ORDER BY created_at DESC LIMIT 100'
      )
    ).rows.map(revision);
  }
  async save(
    expected: string | null,
    body: MusicCatalog
  ): Promise<MusicRevision> {
    const parsed = parseCatalog(body),
      client = await this.pool.connect(),
      id = randomUUID();
    let conflict: boolean;
    try {
      await client.query('BEGIN');
      const head = await client.query(
        'SELECT revision_id FROM music_catalog_head WHERE singleton=true FOR UPDATE'
      );
      conflict = (head.rows[0]?.revision_id ?? null) !== expected;
      await client.query(
        'INSERT INTO music_revisions(id,body,conflict) VALUES($1,$2,$3)',
        [id, JSON.stringify(parsed), conflict]
      );
      if (!conflict)
        await client.query(
          'UPDATE music_catalog_head SET revision_id=$1 WHERE singleton=true',
          [id]
        );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.release();
    }
    if (conflict)
      throw new StudioError(
        409,
        'Another tab saved a newer draft. Both versions are in history.',
        { preservedRevisionId: id }
      );
    return (await this.revision(id))!;
  }
  async playlists(): Promise<MusicPlaylist[]> {
    return (
      await this.pool.query(
        "SELECT body FROM music_provider_cache ORDER BY body->>'title',id"
      )
    ).rows.map((r) => r.body);
  }
  async cache(playlist: MusicPlaylist) {
    await this.pool.query(
      'INSERT INTO music_provider_cache(id,body,checked_at,eligible) VALUES($1,$2,$3,$4) ON CONFLICT(id) DO UPDATE SET body=excluded.body,checked_at=excluded.checked_at,eligible=excluded.eligible',
      [
        playlist.id,
        JSON.stringify(playlist),
        playlist.checkedAt,
        playlist.eligible,
      ]
    );
  }
}
let musicPool: ReturnType<typeof createPool> | undefined;
export function musicStore() {
  const url =
    process.env.MUSIC_PRIVATE_DATABASE_URL ?? process.env.STUDIO_DATABASE_URL;
  if (!url)
    throw new StudioError(503, 'Private Music storage is not configured.');
  return new MusicStore(
    (musicPool ??= createPool({ connectionString: url, max: 5 }))
  );
}
