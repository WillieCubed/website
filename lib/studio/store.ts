import { getCloudflareContext } from '@opennextjs/cloudflare';
import { randomUUID } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';

import { type PostgresPool, createPool } from '@/lib/db/postgres';

import { StudioError } from './errors';
import type {
  ComponentProposal,
  Draft,
  DraftContent,
  Generation,
  GenerationInput,
  Publication,
  Revision,
  StudioStore,
} from './types';

interface StudioQuery {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>>;
}
interface StudioConnection extends StudioQuery {
  release(destroy?: boolean): void | Promise<void>;
}
interface StudioPool extends StudioQuery {
  connect(): Promise<StudioConnection>;
}
interface PostgresFailure extends Error {
  code?: string;
}

let pool: PostgresPool | undefined;
export function getStudioPool(): PostgresPool {
  if (pool) return pool;
  const localUrl = process.env.STUDIO_DATABASE_URL;
  let workerBinding = false;
  try {
    workerBinding = Boolean(getCloudflareContext().env.STUDIO_HYPERDRIVE);
  } catch {
    // Local development uses a direct database URL.
  }
  if (!workerBinding && !localUrl)
    throw new StudioError(503, 'Private writing storage is not configured.');
  return (pool = createPool({
    connectionString: workerBinding ? undefined : localUrl,
    hyperdriveBinding: 'STUDIO_HYPERDRIVE',
  }));
}

export function getStudioStore(): StudioStore {
  return new PostgresStudioStore(getStudioPool());
}

const projection = `SELECT d.id, d.slug, d.live_revision_id, d.deleted_at,
  r.id AS revision_id, r.number, r.body, r.created_at
  FROM studio_documents d JOIN studio_revisions r ON r.id = d.head_id`;

interface RevisionRow {
  id: string;
  revision_id?: string;
  document_id?: string;
  number: number;
  body: DraftContent;
  created_at: string | Date;
}

interface DraftRow extends RevisionRow {
  slug: string;
  live_revision_id: string | null;
  deleted_at: string | Date | null;
}

function revision(row: RevisionRow): Revision {
  return {
    id: row.revision_id ?? row.id,
    documentId: row.document_id ?? row.id,
    number: row.number,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function draft(row: DraftRow): Draft {
  return {
    id: row.id,
    slug: row.slug,
    head: revision(row),
    liveRevisionId: row.live_revision_id,
    deletedAt:
      row.deleted_at !== null && row.deleted_at !== ''
        ? new Date(row.deleted_at).toISOString()
        : null,
  };
}

/** Every head transition is transactional; revisions are insert-only. */
export class PostgresStudioStore implements StudioStore {
  constructor(private pool: StudioPool) {}

  async list() {
    return (
      await this.pool.query<DraftRow>(
        projection + ' WHERE d.deleted_at IS NULL ORDER BY r.created_at DESC'
      )
    ).rows.map(draft);
  }

  async get(id: string) {
    const result = await this.pool.query<DraftRow>(
      projection + ' WHERE d.id = $1 AND d.deleted_at IS NULL',
      [id]
    );
    return result.rows[0] != null ? draft(result.rows[0]) : null;
  }

  async bySlug(slug: string) {
    const result = await this.pool.query<DraftRow>(
      projection + ' WHERE d.slug = $1 AND d.deleted_at IS NULL',
      [slug]
    );
    return result.rows[0] != null ? draft(result.rows[0]) : null;
  }

  async create(slug: string, body: DraftContent): Promise<Draft> {
    const client = await this.pool.connect();
    const id = randomUUID(),
      rid = randomUUID();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO studio_documents(id,slug) VALUES($1,$2)',
        [id, slug]
      );
      await client.query(
        'INSERT INTO studio_revisions(id,document_id,number,body) VALUES($1,$2,1,$3)',
        [rid, id, JSON.stringify(body)]
      );
      await client.query('UPDATE studio_documents SET head_id=$1 WHERE id=$2', [
        rid,
        id,
      ]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as PostgresFailure).code === '23505')
        throw new StudioError(409, 'A writing already uses that address.');
      throw error;
    } finally {
      await client.release();
    }
    return (await this.get(id))!;
  }

  async save(
    id: string,
    expectedRevisionId: string,
    body: DraftContent
  ): Promise<Draft> {
    const client = await this.pool.connect();
    let conflict: StudioError | undefined;
    try {
      await client.query('BEGIN');
      const current = await client.query(
        'SELECT head_id FROM studio_documents WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',
        [id]
      );
      if (current.rows[0] == null)
        throw new StudioError(404, 'Writing not found.');
      const n = await client.query(
        'SELECT COALESCE(MAX(number),0)+1 AS number FROM studio_revisions WHERE document_id=$1',
        [id]
      );
      const rid = randomUUID();
      await client.query(
        'INSERT INTO studio_revisions(id,document_id,number,body) VALUES($1,$2,$3,$4)',
        [rid, id, n.rows[0].number, JSON.stringify(body)]
      );
      if (current.rows[0].head_id !== expectedRevisionId) {
        conflict = new StudioError(
          409,
          'Another save arrived first. Both versions were preserved.',
          {
            currentRevisionId: current.rows[0].head_id,
            conflictRevisionId: rid,
          }
        );
      } else
        await client.query(
          'UPDATE studio_documents SET head_id=$1 WHERE id=$2',
          [rid, id]
        );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.release();
    }
    if (conflict) throw conflict;
    return (await this.get(id))!;
  }

  async revisions(id: string) {
    return (
      await this.pool.query<RevisionRow>(
        'SELECT * FROM studio_revisions WHERE document_id=$1 ORDER BY number DESC',
        [id]
      )
    ).rows.map(revision);
  }

  async revision(id: string) {
    const result = await this.pool.query<RevisionRow>(
      'SELECT * FROM studio_revisions WHERE id=$1',
      [id]
    );
    return result.rows[0] != null ? revision(result.rows[0]) : null;
  }

  async remove(id: string, expectedRevisionId: string) {
    const result = await this.pool.query(
      'UPDATE studio_documents SET deleted_at=now() WHERE id=$1 AND head_id=$2 AND deleted_at IS NULL RETURNING id',
      [id, expectedRevisionId]
    );
    if ((result.rowCount ?? 0) === 0)
      throw new StudioError(
        409,
        'The writing changed. Refresh before deleting.'
      );
  }

  async publication(
    documentId: string,
    revisionId: string
  ): Promise<Publication> {
    const source = await this.revision(revisionId);
    if (!source || source.documentId !== documentId)
      throw new StudioError(404, 'Revision not found.');
    const value: Publication = {
      id: randomUUID(),
      documentId,
      revisionId,
      status: 'publishing',
      commit: null,
      error: null,
      createdAt: new Date().toISOString(),
    };
    const result = await this.pool.query(
      `INSERT INTO studio_publications(id,document_id,revision_id,body) VALUES($1,$2,$3,$4)
      ON CONFLICT(document_id,revision_id) DO UPDATE SET body=studio_publications.body RETURNING body`,
      [value.id, documentId, revisionId, JSON.stringify(value)]
    );
    return result.rows[0].body;
  }

  async getPublication(id: string): Promise<Publication | null> {
    return (
      (
        await this.pool.query(
          'SELECT body FROM studio_publications WHERE id=$1',
          [id]
        )
      ).rows[0]?.body ?? null
    );
  }

  async updatePublication(id: string, update: Partial<Publication>) {
    const { status, commit, error } = update;
    const patch = Object.fromEntries(
      Object.entries({ status, commit, error }).filter(
        ([, v]) => v !== undefined
      )
    );
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'UPDATE studio_publications SET body=body || $2::jsonb WHERE id=$1 RETURNING document_id,revision_id,body',
        [id, JSON.stringify(patch)]
      );
      if (result.rows[0]?.body.status === 'live') {
        const row = result.rows[0];
        // Serialize competing deployment polls before reading the current live number.
        await client.query(
          'SELECT id FROM studio_documents WHERE id=$1 FOR UPDATE',
          [row.document_id]
        );
        await client.query(
          `UPDATE studio_documents d SET live_revision_id=$1 WHERE d.id=$2
          AND (d.live_revision_id IS NULL OR
            (SELECT number FROM studio_revisions WHERE id=d.live_revision_id) <=
            (SELECT number FROM studio_revisions WHERE id=$1))`,
          [row.revision_id, row.document_id]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.release();
    }
  }

  async generation(input: GenerationInput): Promise<Generation> {
    const source = await this.revision(input.revisionId);
    if (!source || source.documentId !== input.documentId)
      throw new StudioError(404, 'Revision not found.');
    const value: Generation = {
      ...input,
      id: randomUUID(),
      status: 'pending',
      result: null,
      error: null,
    };
    await this.pool.query(
      'INSERT INTO studio_generations(id,document_id,revision_id,body) VALUES($1,$2,$3,$4)',
      [value.id, value.documentId, value.revisionId, JSON.stringify(value)]
    );
    return value;
  }

  async getGeneration(id: string): Promise<Generation | null> {
    return (
      (
        await this.pool.query(
          'SELECT body FROM studio_generations WHERE id=$1',
          [id]
        )
      ).rows[0]?.body ?? null
    );
  }

  async updateGeneration(id: string, update: Partial<Generation>) {
    const { status, result, error } = update;
    const patch = Object.fromEntries(
      Object.entries({ status, result, error }).filter(
        ([, v]) => v !== undefined
      )
    );
    await this.pool.query(
      'UPDATE studio_generations SET body=body || $2::jsonb WHERE id=$1',
      [id, JSON.stringify(patch)]
    );
  }

  async proposals(): Promise<ComponentProposal[]> {
    return (
      await this.pool.query('SELECT body FROM studio_components ORDER BY id')
    ).rows.map((row) => row.body);
  }

  async proposal(id: string): Promise<ComponentProposal | null> {
    return (
      (
        await this.pool.query(
          'SELECT body FROM studio_components WHERE id=$1',
          [id]
        )
      ).rows[0]?.body ?? null
    );
  }

  async saveProposal(value: ComponentProposal) {
    await this.pool.query(
      `INSERT INTO studio_components(id,body) VALUES($1,$2)
      ON CONFLICT(id) DO UPDATE SET body=EXCLUDED.body`,
      [value.id, JSON.stringify(value)]
    );
  }
}
