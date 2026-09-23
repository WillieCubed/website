import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import test from 'node:test';

import {
  MicropubStorageError,
  writeMicropubWritingLocally,
} from '@/lib/indieweb/micropub';
import { site } from '@/lib/site';

test('writeMicropubWritingLocally writes a note into the content directory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'micropub-'));
  const contentPath = relative(process.cwd(), join(dir, 'writings'));
  try {
    const result = await writeMicropubWritingLocally(
      {
        h: 'entry',
        content: 'Hello from a Micropub client.',
        categories: ['note'],
        postType: 'note',
        syndication: [],
        syndicateTo: [],
        photos: [],
        slug: 'hello-micropub',
        published: new Date('2026-09-18T12:00:00Z'),
      },
      contentPath
    );

    assert.equal(result.slug, 'hello-micropub');
    assert.equal(result.location, `${site.origin}/writings/hello-micropub`);
    const file = await readFile(
      join(dir, 'writings', 'hello-micropub.mdx'),
      'utf8'
    );
    assert.match(file, /postType: "note"/);
    assert.match(file, /Hello from a Micropub client\./);

    await assert.rejects(
      writeMicropubWritingLocally(
        {
          h: 'entry',
          content: 'Duplicate',
          categories: [],
          postType: 'note',
          syndication: [],
          syndicateTo: [],
          photos: [],
          slug: 'hello-micropub',
        },
        contentPath
      ),
      MicropubStorageError
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeMicropubWritingLocally reports an unwritable directory as a storage error', async () => {
  // /dev/null is a file, so creating a directory under it fails on every OS.
  await assert.rejects(
    writeMicropubWritingLocally(
      {
        h: 'entry',
        content: 'Nowhere to go',
        categories: [],
        postType: 'note',
        syndication: [],
        syndicateTo: [],
        photos: [],
      },
      relative(process.cwd(), '/dev/null/writings')
    ),
    MicropubStorageError
  );
});
