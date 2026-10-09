import { createPool } from '@vercel/postgres';

export interface ResponseObservationStore {
  observe(copyUri: string, actorDids: string[]): Promise<Map<string, Date>>;
}

const MAX_ACTORS = 1_000;
const BATCH_SIZE = 100;
let pool: ReturnType<typeof createPool> | undefined;

/** Receipts identify public sources and never store authentication state. */
export const responseObservationStore: ResponseObservationStore = {
  async observe(copyUri, actorDids) {
    const actors = [...new Set(actorDids)].slice(0, MAX_ACTORS);
    const observed = new Map<string, Date>();
    if (!actors.length) return observed;
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
        SELECT actor_did, observed_at FROM atproto_response_observations
        WHERE copy_uri = ${copyUri} AND actor_did IN (
          SELECT jsonb_array_elements_text(${batch}::jsonb)
        )
      `;
      for (const row of result.rows) {
        const date = new Date(row.observed_at);
        if (Number.isFinite(date.getTime())) observed.set(row.actor_did, date);
      }
    }
    return observed;
  },
};
