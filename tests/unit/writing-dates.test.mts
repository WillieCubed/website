import assert from 'node:assert/strict';
import test from 'node:test';

import { getWritingSlugs, loadWriting } from '@/lib/writings';

test('loadWriting returns real Dates for published and lastUpdated', async () => {
  const slugs = await getWritingSlugs();
  assert.ok(slugs.length > 0, 'content/writings has writings');

  for (const slug of slugs) {
    const { writing } = await loadWriting(slug);
    assert.ok(writing.published instanceof Date, `${slug}: published`);
    assert.ok(writing.lastUpdated instanceof Date, `${slug}: lastUpdated`);
  }
});
