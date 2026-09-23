import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { getFileSlugs } from '@/lib/data/markdown-loader';

test('getFileSlugs skips hidden .md and .mdx files and non-markdown files', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'markdown-loader-'));
  try {
    for (const file of [
      'entry.md',
      'post.mdx',
      '_template.md',
      '_template.mdx',
      'notes.txt',
    ]) {
      writeFileSync(join(directory, file), '');
    }

    const slugs = await getFileSlugs(directory);
    assert.deepEqual(slugs.sort(), ['entry', 'post']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
