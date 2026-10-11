import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { Pool } from 'pg';

import { PostgresStudioStore } from '../../lib/studio/store';
import type { DraftContent } from '../../lib/studio/types';

test(
  'concurrent saves preserve both immutable revisions without overwriting the winning head',
  { skip: !process.env.STUDIO_TEST_DATABASE_URL },
  async () => {
    const schema = 'studio_test_' + randomUUID().replaceAll('-', '');
    const admin = new Pool({
      connectionString: process.env.STUDIO_TEST_DATABASE_URL,
    });
    await admin.query(`CREATE SCHEMA ${schema}`);
    const pool = new Pool({
      connectionString: process.env.STUDIO_TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    try {
      await pool.query(
        await readFile('lib/db/migrations/005_studio.sql', 'utf8')
      );
      const store = new PostgresStudioStore(pool);
      const body: DraftContent = {
        title: 'Private',
        description: '',
        postType: 'article',
        tags: [],
        document: {
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
          ],
        },
      };
      const first = await store.create('a-private-writing', body);
      await assert.rejects(
        pool.query('UPDATE studio_revisions SET body=$1 WHERE id=$2', [
          JSON.stringify({ ...body, title: 'Tampered' }),
          first.head.id,
        ]),
        /immutable/
      );
      await assert.rejects(
        pool.query('DELETE FROM studio_revisions WHERE id=$1', [first.head.id]),
        /immutable/
      );
      const attempts = await Promise.allSettled([
        store.save(first.id, first.head.id, { ...body, title: 'A' }),
        store.save(first.id, first.head.id, { ...body, title: 'B' }),
      ]);
      assert.equal(attempts.filter((x) => x.status === 'fulfilled').length, 1);
      assert.equal(attempts.filter((x) => x.status === 'rejected').length, 1);
      assert.equal((await store.revisions(first.id)).length, 3);
      assert.equal(
        (await store.revision(first.head.id))?.body.title,
        'Private'
      );
      const winner = attempts.find((x) => x.status === 'fulfilled');
      assert.equal(
        (await store.get(first.id))?.head.id,
        winner?.status === 'fulfilled' ? winner.value.head.id : 'missing'
      );
      const publication = await store.publication(first.id, first.head.id);
      assert.equal(
        (await store.publication(first.id, first.head.id)).id,
        publication.id
      );
      await store.updatePublication(publication.id, {
        status: 'live',
        commit: 'abc',
      });
      assert.equal((await store.get(first.id))?.liveRevisionId, first.head.id);
      const latest = (await store.get(first.id))!;
      const newerPublication = await store.publication(
        first.id,
        latest.head.id
      );
      await store.updatePublication(newerPublication.id, {
        status: 'live',
        commit: 'def',
      });
      await store.updatePublication(publication.id, {
        status: 'live',
        commit: 'abc',
      });
      assert.equal(
        (await store.get(first.id))?.liveRevisionId,
        latest.head.id,
        'late polls cannot regress the live revision'
      );
      await store.remove(first.id, (await store.get(first.id))!.head.id);
      assert.equal((await store.list()).length, 0);
      assert.equal((await store.revisions(first.id)).length, 3);
    } finally {
      await pool.end();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.end();
    }
  }
);
