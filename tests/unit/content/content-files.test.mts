import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { markdownFiles, readMarkdownFile } from '@/lib/content/files';
import { statusFromDates } from '@/lib/content/status';

test('Markdown discovery preserves domain extension and hidden-file policies', () => {
  const dir = mkdtempSync(join(tmpdir(), 'content-files-'));
  try {
    for (const name of ['a.md', 'b.mdx', '_draft.mdx', 'notes.txt'])
      writeFileSync(join(dir, name), name);
    assert.deepEqual(markdownFiles(dir), ['a.md', 'b.mdx']);
    assert.deepEqual(markdownFiles(dir, ['.mdx']), ['b.mdx']);
    assert.deepEqual(markdownFiles(join(dir, 'absent'), ['.mdx'], true), []);
    assert.throws(() => markdownFiles(join(dir, 'absent')), /ENOENT/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Markdown reading prefers MDX and retains fallback and read-error behavior', () => {
  const dir = mkdtempSync(join(tmpdir(), 'content-read-'));
  try {
    writeFileSync(join(dir, 'entry.md'), 'markdown');
    assert.equal(
      readMarkdownFile(dir, 'entry', 'missing').source.toString(),
      'markdown'
    );
    writeFileSync(join(dir, 'entry.mdx'), 'mdx');
    assert.equal(
      readMarkdownFile(dir, 'entry', 'missing').source.toString(),
      'mdx'
    );
    mkdirSync(join(dir, 'bad.mdx'));
    writeFileSync(join(dir, 'bad.md'), 'fallback');
    assert.throws(
      () => readMarkdownFile(dir, 'bad', 'missing', 'exists'),
      /EISDIR/
    );
    assert.equal(
      readMarkdownFile(dir, 'bad', 'missing').source.toString(),
      'fallback'
    );
    assert.throws(
      () => readMarkdownFile(dir, 'absent', 'specific message'),
      /specific message/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('date-derived status preserves explicit values and inclusive local end dates', () => {
  const start = new Date(2026, 9, 1),
    end = new Date(2026, 9, 13);
  const original = end.getTime();
  assert.equal(
    statusFromDates('paused', start, end, new Date(2026, 9, 14)),
    'paused'
  );
  assert.equal(
    statusFromDates(undefined, start, end, new Date(2026, 8, 30)),
    'planned'
  );
  assert.equal(
    statusFromDates(
      undefined,
      start,
      end,
      new Date(2026, 9, 13, 23, 59, 59, 999)
    ),
    'active'
  );
  assert.equal(
    statusFromDates(undefined, start, end, new Date(2026, 9, 14)),
    'complete'
  );
  assert.equal(
    statusFromDates(undefined, undefined, undefined, start),
    'planned'
  );
  assert.equal(end.getTime(), original);
});
