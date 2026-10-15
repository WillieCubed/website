import { getCloudflareContext } from '@opennextjs/cloudflare';
import { Client, Pool, type QueryResult, type QueryResultRow } from 'pg';

type Value = string | number | boolean | null | undefined;
type SqlTag = <T extends QueryResultRow = QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: Value[]
) => Promise<QueryResult<T>>;

export interface PostgresPoolClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>>;
  sql: SqlTag;
  release(destroy?: boolean): void | Promise<void>;
}

export interface PostgresPool {
  sql: SqlTag;
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>>;
  connect(): Promise<PostgresPoolClient>;
  end(): Promise<void>;
}

const localPools = new Map<string, Pool>();
// Bound client connection and response waits without assuming pooled session settings.
const clientDeadlines = {
  connectionTimeoutMillis: 5000,
  query_timeout: 5000,
};

export type DatabaseBinding = 'HYPERDRIVE' | 'STUDIO_HYPERDRIVE';

function workerConnectionString(
  binding: DatabaseBinding = 'HYPERDRIVE',
  override?: string
): string | null {
  try {
    const context = getCloudflareContext();
    return override ?? context.env[binding]?.connectionString ?? null;
  } catch {
    return null;
  }
}

export function hasDatabase(): boolean {
  if (process.env.POSTGRES_URL || process.env.DATABASE_URL) return true;
  return Boolean(workerConnectionString());
}

function localConnectionString(): string {
  const direct = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!direct)
    throw new Error('A Postgres URL is required outside Cloudflare.');
  return direct;
}

function localPool(max = 2, override?: string): Pool {
  const url = override || localConnectionString();
  const key = `${max}:${url}`;
  let existing = localPools.get(key);
  if (!existing) {
    existing = new Pool({ connectionString: url, max, ...clientDeadlines });
    localPools.set(key, existing);
  }
  return existing;
}

function queryTag(
  query: (text: string, values: Value[]) => Promise<QueryResult>
) {
  const tag: SqlTag = (strings, ...values) => {
    const text = strings.reduce(
      (statement, part, index) => statement + (index ? `$${index}` : '') + part,
      ''
    );
    return query(text, values);
  };
  return tag;
}

export function createPool(
  config: {
    max?: number;
    connectionString?: string;
    hyperdriveBinding?: DatabaseBinding;
  } = {}
): PostgresPool {
  const workerUrl = () =>
    workerConnectionString(config.hyperdriveBinding, config.connectionString);
  const query = async (text: string, values?: unknown[]) => {
    const url = workerUrl();
    if (!url)
      return localPool(config.max, config.connectionString).query(text, values);

    // Worker I/O objects belong to one request. Hyperdrive pools at the edge;
    // retaining a pg Pool across invocations can hang the next request.
    const client = new Client({ connectionString: url, ...clientDeadlines });
    try {
      await client.connect();
      return await client.query(text, values);
    } finally {
      await client.end();
    }
  };
  return {
    sql: queryTag((text, values) => query(text, values)),
    query,
    async connect() {
      const url = workerUrl();
      if (url) {
        const client = new Client({
          connectionString: url,
          ...clientDeadlines,
        });
        await client.connect();
        return {
          query: (text, values) => client.query(text, values),
          sql: queryTag((text, values) => client.query(text, values)),
          release: () => client.end(),
        };
      }
      const client = await localPool(
        config.max,
        config.connectionString
      ).connect();
      return {
        query: (text, values) => client.query(text, values),
        sql: queryTag((text, values) => client.query(text, values)),
        release: (destroy) => client.release(destroy),
      };
    },
    async end() {
      if (workerUrl()) return;
      const url = config.connectionString || localConnectionString();
      const key = `${config.max ?? 2}:${url}`;
      const pool = localPools.get(key);
      if (!pool) return;
      localPools.delete(key);
      await pool.end();
    },
  };
}

const defaultPool = createPool();
export const sql = Object.assign(
  queryTag((text, values) => defaultPool.query(text, values)),
  {
    query: defaultPool.query,
    connect: defaultPool.connect,
    end: defaultPool.end,
  }
);
