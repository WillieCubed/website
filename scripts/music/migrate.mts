import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

const scopes = process.argv.includes('--public-only')
  ? ['public']
  : process.argv.includes('--private-only')
    ? ['private']
    : ['private', 'public'];
for (const scope of scopes) {
  const connectionString =
    scope === 'private'
      ? process.env.STUDIO_DATABASE_URL
      : (process.env.MUSIC_PUBLIC_DATABASE_URL ?? process.env.POSTGRES_URL);
  if (!connectionString)
    throw new Error(`${scope} music database is not configured.`);
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        await readFile(
          new URL(`../../lib/music/migrations/${scope}.sql`, import.meta.url),
          'utf8'
        )
      );
      await client.query('COMMIT');
      console.log(`${scope} Music schema is ready.`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}
