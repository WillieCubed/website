import { readFile } from 'node:fs/promises';

import { getStudioPool } from '../../lib/studio/store';

const pool = getStudioPool();
const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const file of ['005_studio.sql', '006_studio_lattice.sql']) {
    await client.query(
      await readFile(
        new URL(`../../lib/db/migrations/${file}`, import.meta.url),
        'utf8'
      )
    );
  }
  await client.query('COMMIT');
  console.log('Private studio schema is ready.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
