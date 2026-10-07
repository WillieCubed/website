import type {
  OAuthClientStores,
  Store,
  StoredSession,
  StoredState,
} from '@atcute/oauth-node-client';
import { type VercelPoolClient, sql } from '@vercel/postgres';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';

import { digest } from './oauth-binding';
import { decryptOAuthValue, encryptOAuthValue } from './oauth-crypto';
import type { BrowserSession } from './social-http';

const transaction = new AsyncLocalStorage<VercelPoolClient>();
function query(text: string, values?: unknown[]) {
  return (transaction.getStore() ?? sql).query(text, values);
}

function encryptedStore<T>(
  table: 'atproto_oauth_states' | 'atproto_oauth_sessions',
  key: string,
  expires: (value: T) => Date
): Store<string, T> {
  return {
    async get(id) {
      const { rows } = await query(
        `SELECT encrypted_value FROM ${table} WHERE key_hash = $1 AND expires_at > NOW()`,
        [digest(id)]
      );
      return rows[0]
        ? decryptOAuthValue<T>(rows[0].encrypted_value, key)
        : undefined;
    },
    async set(id, value) {
      await query(`DELETE FROM ${table} WHERE expires_at <= NOW()`);
      await query(
        `INSERT INTO ${table} (key_hash, encrypted_value, expires_at) VALUES ($1, $2, $3) ON CONFLICT (key_hash) DO UPDATE SET encrypted_value = EXCLUDED.encrypted_value, expires_at = EXCLUDED.expires_at`,
        [
          digest(id),
          encryptOAuthValue(value, key),
          expires(value).toISOString(),
        ]
      );
    },
    async delete(id) {
      await query(`DELETE FROM ${table} WHERE key_hash = $1`, [digest(id)]);
    },
    async clear() {
      await query(`DELETE FROM ${table}`);
    },
  };
}

export function oauthStores(key: string): OAuthClientStores {
  return {
    states: encryptedStore<StoredState>(
      'atproto_oauth_states',
      key,
      (state) => new Date(state.expiresAt)
    ),
    sessions: encryptedStore<StoredSession>(
      'atproto_oauth_sessions',
      key,
      () => new Date(Date.now() + 180 * 86400000)
    ),
  };
}

/** A transaction pins the connection even when Neon uses transaction pooling. */
export async function withOAuthLock<T>(
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  const existing = transaction.getStore();
  if (existing) {
    await existing.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [name]
    );
    return fn();
  }
  const client = await sql.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [name]
    );
    // Nested SDK locks and encrypted stores must share this pinned connection.
    const result = await transaction.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    // A provider may have consumed a single-use refresh token already.
    // Persist credential progress even when the subsequent PDS write fails.
    await client
      .query('COMMIT')
      .catch(() => client.query('ROLLBACK').catch(() => {}));
    throw error;
  } finally {
    client.release();
  }
}

export async function issueBrowserSession(did: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await sql`DELETE FROM atproto_browser_sessions WHERE expires_at <= NOW()`;
  await sql`INSERT INTO atproto_browser_sessions (token_hash, did, expires_at) VALUES (${digest(token)}, ${did}, NOW() + INTERVAL '30 days')`;
  return token;
}

export async function readBrowserSession(
  token: string
): Promise<BrowserSession | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const { rows } =
    await sql`SELECT did FROM atproto_browser_sessions WHERE token_hash = ${digest(token)} AND expires_at > NOW()`;
  return rows[0] ? { did: rows[0].did, id: token } : null;
}

export async function deleteBrowserSession(token: string): Promise<void> {
  await sql`DELETE FROM atproto_browser_sessions WHERE token_hash = ${digest(token)}`;
}

export async function socialRateLimit(key: string): Promise<boolean> {
  await sql`DELETE FROM atproto_rate_limits WHERE expires_at <= NOW()`;
  const { rows } = await sql`
    INSERT INTO atproto_rate_limits (key_hash, hits, expires_at) VALUES (${digest(key)}, 1, NOW() + INTERVAL '1 minute')
    ON CONFLICT (key_hash) DO UPDATE SET hits = atproto_rate_limits.hits + 1 RETURNING hits
  `;
  return rows[0].hits <= (key.startsWith('read:') ? 60 : 10);
}
