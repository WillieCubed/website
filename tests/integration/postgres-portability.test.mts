import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { createPool } from '@/lib/db/postgres';
import { micropubArchiveStore } from '@/lib/indieweb/micropub-archive';
import { MicropubConflictError } from '@/lib/indieweb/micropub-store';

const url = process.env.WEBSITE_TEST_DATABASE_URL;

test(
  'Postgres facade parameterizes tags and pins transaction queries to one connection',
  { skip: !url },
  async () => {
    if (!url) return;
    const database = createPool({ connectionString: url, max: 2 });
    try {
      const value = "O'Brien; SELECT 1";
      const tagged = await database.sql`SELECT ${value}::text AS value`;
      assert.equal(tagged.rows[0].value, value);

      const client = await database.connect();
      try {
        await client.sql`BEGIN`;
        const first = await client.sql`SELECT pg_backend_pid() AS pid`;
        const second = await client.query('SELECT pg_backend_pid() AS pid');
        assert.equal(first.rows[0].pid, second.rows[0].pid);
        await client.sql`ROLLBACK`;
      } finally {
        await client.release();
      }
    } finally {
      await database.end();
    }
  }
);

test(
  'Micropub archive lock rejects overlap and releases after success or failure',
  { skip: !url },
  async () => {
    if (!url) return;
    const originalUrl = process.env.POSTGRES_URL;
    process.env.POSTGRES_URL = url;
    const key = `integration:${randomUUID()}`;
    let entered!: () => void;
    let releaseFirst!: () => void;
    const firstEntered = new Promise<void>((resolve) => (entered = resolve));
    const holdFirst = new Promise<void>((resolve) => (releaseFirst = resolve));
    try {
      const first = micropubArchiveStore.runExclusive(key, async () => {
        entered();
        await holdFirst;
        return 'first';
      });
      await Promise.race([
        firstEntered,
        first.then(() => {
          throw new Error(
            'The first mutation ended before acquiring its lock.'
          );
        }),
      ]);
      try {
        await assert.rejects(
          micropubArchiveStore.runExclusive(key, async () => 'overlap'),
          MicropubConflictError
        );
      } finally {
        releaseFirst();
      }
      assert.equal(await first, 'first');
      assert.equal(
        await micropubArchiveStore.runExclusive(key, async () => 'next'),
        'next'
      );
      await assert.rejects(
        micropubArchiveStore.runExclusive(key, async () => {
          throw new Error('operation failed');
        }),
        /operation failed/
      );
      assert.equal(
        await micropubArchiveStore.runExclusive(key, async () => 'recovered'),
        'recovered'
      );
    } finally {
      releaseFirst?.();
      if (originalUrl === undefined) delete process.env.POSTGRES_URL;
      else process.env.POSTGRES_URL = originalUrl;
    }
  }
);
