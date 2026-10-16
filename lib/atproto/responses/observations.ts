import { unstable_cache } from 'next/cache';

import { type PostgresPool, createPool } from '@/lib/db/postgres';

export interface ResponseObservationStore {
  observe(copyUri: string, actorDids: string[]): Promise<Map<string, Date>>;
}

const MAX_ACTORS = 1_000;
const BATCH_SIZE = 100;
let pool: PostgresPool | undefined;

export function canonicalRepostActors(actorDids: string[]): string[] {
  return [...new Set(actorDids)].sort().slice(0, MAX_ACTORS);
}

const cachedReceipts = unstable_cache(
  async (copyUri: string, actors: string[]): Promise<[string, string][]> => {
    const observed: [string, string][] = [];
    const database = (pool ??= createPool({ max: 2 }));
    for (let offset = 0; offset < actors.length; offset += BATCH_SIZE) {
      const batch = JSON.stringify(actors.slice(offset, offset + BATCH_SIZE));
      await database.sql`
        INSERT INTO atproto_response_observations (copy_uri, actor_did)
        SELECT ${copyUri}, actor_did
        FROM jsonb_array_elements_text(${batch}::jsonb) AS actors(actor_did)
        ON CONFLICT (copy_uri, actor_did) DO NOTHING
      `;
      // A separate statement sees a competing insert after ON CONFLICT waited.
      const result = await database.sql`
        SELECT actor_did, observed_at,
          clock_timestamp() AS origin_read_at
        FROM atproto_response_observations
        WHERE copy_uri = ${copyUri} AND actor_did IN (
          SELECT jsonb_array_elements_text(${batch}::jsonb)
        )
      `;
      for (const row of result.rows) {
        const date = new Date(row.observed_at);
        if (Number.isFinite(date.getTime()))
          observed.push([row.actor_did, date.toISOString()]);
      }
    }
    return observed;
  },
  ['native-repost-observations'],
  { revalidate: 60 * 60 }
);

/** Receipts identify public sources and never store authentication state. */
export const responseObservationStore: ResponseObservationStore = {
  async observe(copyUri, actorDids) {
    const actors = canonicalRepostActors(actorDids);
    if (actors.length === 0) return new Map();
    const receipts = await cachedReceipts(copyUri, actors);
    return new Map(
      receipts.map(([did, timestamp]) => [did, new Date(timestamp)])
    );
  },
};
