import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createPool, sql } from '@/lib/db/postgres';
import {
  getWebmention,
  getWebmentionBySourceTarget,
  getWebmentionsForTarget,
  listApprovedWebmentions,
  webmentionModerationStore,
} from '@/lib/indieweb/webmention/storage';

const url = process.env.WEBSITE_TEST_DATABASE_URL;

test(
  'shared Webmention reads preserve private moderation, public filtering and parameterized destinations',
  { skip: !url },
  async () => {
    if (!url) return;
    const schema = `webmention_${randomUUID().replaceAll('-', '')}`;
    const database = createPool({ connectionString: url, max: 1 });
    const previous = process.env.POSTGRES_URL;
    const scoped = new URL(url);
    scoped.searchParams.set('options', `-c search_path=${schema}`);
    try {
      await database.query(`CREATE SCHEMA ${schema}`);
      process.env.POSTGRES_URL = scoped.href;
      for (const file of [
        '000_webmentions.sql',
        '001_level4_tables.sql',
        '004_webmention_responses.sql',
      ]) {
        const migration = await readFile(
          new URL(`../../../lib/db/migrations/${file}`, import.meta.url),
          'utf8'
        );
        // The historical migration checks every schema; fixture siblings must
        // not cause it to skip columns in this test's isolated table.
        await sql.query(
          migration.replaceAll(
            "WHERE table_name = 'webmentions'",
            "WHERE table_schema = current_schema() AND table_name = 'webmentions'"
          )
        );
      }
      const target = "https://example.invalid/writings/reader's-note";
      const source = "https://author.invalid/a?quote=';SELECT 1";
      const result = await sql.query(
        `INSERT INTO webmentions(source_url,target_url,type,is_verified,raw_mf2_json) VALUES($1,$2,'reply',TRUE,$3) RETURNING id`,
        [source, target, { properties: { name: ['A title'] } }]
      );
      const id = result.rows[0].id as string;
      assert.equal((await getWebmention(id))?.name, 'A title');
      assert.equal((await getWebmentionBySourceTarget(source, target))?.id, id);
      assert.equal((await webmentionModerationStore.listPending()).length, 1);
      assert.equal((await getWebmentionsForTarget(target)).replies.length, 0);
      assert.equal((await listApprovedWebmentions()).length, 0);
      assert.equal(await webmentionModerationStore.approve(id), true);
      assert.equal((await getWebmentionsForTarget(target)).replies[0]?.id, id);
      assert.equal((await listApprovedWebmentions())[0]?.id, id);
      assert.equal((await webmentionModerationStore.listPending()).length, 0);
      assert.equal(await webmentionModerationStore.reject(id), true);
      assert.equal((await listApprovedWebmentions()).length, 0);
    } finally {
      await sql.end();
      if (previous === undefined) delete process.env.POSTGRES_URL;
      else process.env.POSTGRES_URL = previous;
      await database.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await database.end();
    }
  }
);
