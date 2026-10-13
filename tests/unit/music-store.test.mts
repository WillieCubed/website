import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Pool } from 'pg';

import { MusicStore } from '../../lib/music/store';
import { emptyCatalog } from '../../lib/music/types';

test(
  'Music revisions survive concurrent saves, reject mutation, and restore as a new head',
  { skip: !process.env.STUDIO_TEST_DATABASE_URL },
  async () => {
    const schema = 'music_test_' + randomUUID().replaceAll('-', '');
    const admin = new Pool({
      connectionString: process.env.STUDIO_TEST_DATABASE_URL,
    });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({
      connectionString: process.env.STUDIO_TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
      max: 2,
    });
    try {
      const sql = await readFile('lib/music/migrations/private.sql', 'utf8');
      await pool.query(sql);
      await pool.query(sql);
      const store = new MusicStore(pool),
        first = await store.save(null, emptyCatalog);
      const outcomes = await Promise.allSettled([
        store.save(first.id, {
          ...emptyCatalog,
          series: [{ id: 'fall', title: 'Fall', playlistIds: [] }],
        }),
        store.save(first.id, {
          ...emptyCatalog,
          series: [{ id: 'summer', title: 'Summer', playlistIds: [] }],
        }),
      ]);
      assert.equal(outcomes.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal((await store.history()).length, 3);
      assert.equal((await store.history()).filter((r) => r.conflict).length, 1);
      await assert.rejects(
        pool.query('UPDATE music_revisions SET body=$1 WHERE id=$2', [
          JSON.stringify(emptyCatalog),
          first.id,
        ]),
        /immutable/
      );
      await assert.rejects(
        pool.query('DELETE FROM music_revisions WHERE id=$1', [first.id]),
        /immutable/
      );
      const restored = await store.save((await store.head())!.id, first.body);
      assert.notEqual(restored.id, first.id);
      assert.deepEqual((await store.head())?.body, emptyCatalog);
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  }
);
