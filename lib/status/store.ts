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
}
export function createStatusStore(query: Query): StatusStore {
  return {
    async read() {
      const { rows } = await query(
        // Hyperdrive does not invalidate cached SELECTs after a write. The
        // volatile timestamp keeps this read fresh for owner edits; the
        // public reader has its own three-hour Next data cache.
        'SELECT location, updated_at, clock_timestamp() AS origin_read_at FROM status_location WHERE singleton = true'
      );
      if (rows[0] == null) return null;
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
  };
}
