import {
  type City,
  type LocationSnapshot,
  type LocationSource,
  citySchema,
} from './location';

export type Query = (
  text: string,
  values?: unknown[]
) => Promise<{ rows: Record<string, unknown>[] }>;
export interface StatusStore extends LocationSource {
  save(city: City): Promise<void>;
  createSession(hash: string, expires: Date): Promise<void>;
  hasSession(hash: string): Promise<boolean>;
  deleteSession(hash: string): Promise<void>;
}
export function createStatusStore(query: Query): StatusStore {
  return {
    async read() {
      const { rows } = await query(
        'SELECT location, updated_at FROM status_location WHERE singleton = true'
      );
      if (!rows[0]) return null;
      return {
        source: 'manual',
        location: citySchema.parse(rows[0].location),
        updatedAt: new Date(String(rows[0].updated_at)).toISOString(),
      } satisfies LocationSnapshot;
    },
    async save(city) {
      const value = citySchema.parse(city);
      await query(
        `INSERT INTO status_location (singleton, source, location) VALUES (true, 'manual', $1::jsonb)
        ON CONFLICT (singleton) DO UPDATE SET location = EXCLUDED.location, updated_at = now()`,
        [JSON.stringify(value)]
      );
    },
    async createSession(hash, expires) {
      await query(
        'DELETE FROM status_admin_sessions WHERE expires_at <= now()'
      );
      await query(
        'INSERT INTO status_admin_sessions (token_hash, expires_at) VALUES ($1, $2)',
        [hash, expires.toISOString()]
      );
    },
    async hasSession(hash) {
      const { rows } = await query(
        'SELECT token_hash FROM status_admin_sessions WHERE token_hash = $1 AND expires_at > now()',
        [hash]
      );
      return rows.length === 1;
    },
    async deleteSession(hash) {
      await query('DELETE FROM status_admin_sessions WHERE token_hash = $1', [
        hash,
      ]);
    },
  };
}
