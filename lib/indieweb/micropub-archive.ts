import { createPool } from '@vercel/postgres';
import { posix, resolve } from 'node:path';

import {
  MicropubConflictError,
  type StoredWriting,
} from '@/lib/indieweb/micropub-store';
import type { MicropubRouteEnvironment } from '@/lib/indieweb/types';

export interface ArchivedWriting extends StoredWriting {
  url: string;
  state: 'archived' | 'deleted' | 'restored';
}

/** Private archives commit separately from the transaction holding the lock. */
export interface MicropubArchiveStore {
  runExclusive<T>(key: string, operation: () => Promise<T>): Promise<T>;
  save(key: string, url: string, writing: StoredWriting): Promise<void>;
  find(key: string): Promise<ArchivedWriting | null>;
  mark(key: string, state: 'deleted' | 'restored'): Promise<void>;
}

export function micropubMutationKey(
  environment: MicropubRouteEnvironment,
  url: string
): string {
  const remote = Boolean(
    environment.githubRepository && environment.githubToken
  );
  return JSON.stringify([
    remote ? environment.githubRepository!.toLowerCase() : process.cwd(),
    remote ? environment.defaultBranch : 'local',
    remote
      ? posix.normalize(environment.contentPath)
      : resolve(process.cwd(), environment.contentPath),
    url,
  ]);
}

let lockPool: ReturnType<typeof createPool> | undefined;
let archivePool: ReturnType<typeof createPool> | undefined;
function queryStore() {
  return (archivePool ??= createPool({ max: 2 }));
}

export const micropubArchiveStore: MicropubArchiveStore = {
  async runExclusive(key, operation) {
    const client = await (lockPool ??= createPool({ max: 2 })).connect();
    let transaction = false;
    let destroy = false;
    try {
      // Transaction locks stay on one backend with Neon transaction pooling.
      // Archive queries use another pool so their commits precede file writes.
      await client.sql`BEGIN`;
      transaction = true;
      const result =
        await client.sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS locked`;
      if (!result.rows[0].locked)
        throw new MicropubConflictError(
          'Another request is changing this post.'
        );
      const resultValue = await operation();
      await client.sql`COMMIT`;
      transaction = false;
      return resultValue;
    } catch (error) {
      if (transaction) {
        try {
          await client.sql`ROLLBACK`;
        } catch {
          destroy = true;
        }
      }
      throw error;
    } finally {
      client.release(destroy);
    }
  },
  async save(key, url, writing) {
    // Commit the source before deleting its public file. A storage failure
    // can then leave a redundant archive, but cannot erase the only copy.
    await queryStore().sql`
      INSERT INTO micropub_deleted_writings (
        mutation_key, permalink, slug, path, source, original_sha, state
      ) VALUES (
        ${key}, ${url}, ${writing.slug}, ${writing.path}, ${writing.source},
        ${writing.sha ?? null}, 'archived'
      ) ON CONFLICT (mutation_key) DO UPDATE SET
        permalink = EXCLUDED.permalink, slug = EXCLUDED.slug,
        path = EXCLUDED.path, source = EXCLUDED.source,
        original_sha = EXCLUDED.original_sha, state = 'archived',
        archived_at = NOW(), deleted_at = NULL, restored_at = NULL
    `;
  },
  async find(key) {
    const result = await queryStore().sql`
      SELECT permalink, slug, path, source, original_sha, state
      FROM micropub_deleted_writings WHERE mutation_key = ${key}
    `;
    const row = result.rows[0];
    return row
      ? {
          url: row.permalink,
          slug: row.slug,
          path: row.path,
          source: row.source,
          ...(row.original_sha ? { sha: row.original_sha } : {}),
          state: row.state,
        }
      : null;
  },
  async mark(key, state) {
    await queryStore().sql`
      UPDATE micropub_deleted_writings SET state = ${state},
        deleted_at = CASE WHEN ${state} = 'deleted' THEN NOW() ELSE deleted_at END,
        restored_at = CASE WHEN ${state} = 'restored' THEN NOW() ELSE NULL END
      WHERE mutation_key = ${key}
    `;
  },
};
