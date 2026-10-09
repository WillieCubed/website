import assert from 'node:assert/strict';
import test from 'node:test';

import { localBlob } from '@/lib/atproto/blobs';
import {
  DOCUMENT_COLLECTION,
  PUBLICATION_COLLECTION,
} from '@/lib/atproto/config';
import { documentUri } from '@/lib/atproto/keys';
import { type DocumentSource, documentPath } from '@/lib/atproto/records';
import { syncAtproto } from '@/lib/atproto/sync';
import type {
  ExistingRecord,
  LocalBlob,
  RepoClient,
  Write,
} from '@/lib/atproto/types';
import { absoluteUrl, site } from '@/lib/site';

function fakeRepo() {
  const records: ExistingRecord[] = [];
  const log = { writes: [] as Write[], uploads: [] as LocalBlob[] };
  const client: RepoClient = {
    async listRecords(collection) {
      return records.filter((record) => record.collection === collection);
    },
    async applyWrites(writes) {
      log.writes.push(...writes);
      for (const write of writes) {
        const at = records.findIndex(
          (r) => r.collection === write.collection && r.rkey === write.rkey
        );
        if (at >= 0) records.splice(at, 1);
        if (write.$type !== 'com.atproto.repo.applyWrites#delete') {
          records.push({
            collection: write.collection,
            rkey: write.rkey,
            cid: 'bafyrei-fake',
            value: JSON.parse(JSON.stringify(write.value)),
          });
        }
      }
    },
    async uploadBlob(blob) {
      log.uploads.push(blob);
    },
    async close() {},
  };
  return { client, records, log };
}

const note: DocumentSource = {
  slug: 'a-note',
  title: 'A note about the site.',
  description: 'A note about the site.',
  published: new Date('2026-10-01T12:00:00Z'),
  lastUpdated: new Date('2026-10-01T12:00:00Z'),
  tags: [],
  body: 'A note about the site.',
};

const png = async () =>
  localBlob(new TextEncoder().encode('hello'), 'image/png');

test('a blob reference is the raw CID of its bytes', async () => {
  const blob = await png();
  assert.deepEqual(blob.ref, {
    $type: 'blob',
    ref: {
      $link: 'bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq',
    },
    mimeType: 'image/png',
    size: 5,
  });
});

test('without an app password the sync skips', async () => {
  const saved = process.env.ATPROTO_APP_PASSWORD;
  delete process.env.ATPROTO_APP_PASSWORD;
  try {
    const report = await syncAtproto({ writings: [note], fetchImage: png });
    assert.equal(report.status, 'skipped');
  } finally {
    if (saved !== undefined) process.env.ATPROTO_APP_PASSWORD = saved;
  }
});

test('a failed sign-out does not fail a sync that wrote', async () => {
  const { client, records } = fakeRepo();
  const saved = process.env.ATPROTO_APP_PASSWORD;
  process.env.ATPROTO_APP_PASSWORD = 'dummy-app-password';
  const warn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => void warnings.push(args);
  try {
    const report = await syncAtproto({
      createClient: async () => ({
        ...client,
        close: async () => {
          throw new Error('logout failed');
        },
      }),
      writings: [note],
      fetchImage: png,
    });
    assert.equal(report.status, 'synced');
    assert.equal(records.length, 2, 'the writes still landed');
    assert.equal(warnings.length, 1, 'the sign-out failure is warned about');
  } finally {
    console.warn = warn;
    if (saved === undefined) delete process.env.ATPROTO_APP_PASSWORD;
    else process.env.ATPROTO_APP_PASSWORD = saved;
  }
});

test('a dry run plans without writing', async () => {
  const { client, log } = fakeRepo();
  const report = await syncAtproto({
    client,
    dryRun: true,
    writings: [note],
    fetchImage: png,
  });
  assert.equal(report.status, 'planned');
  assert.equal(report.status !== 'skipped' && report.created, 2);
  assert.deepEqual(log.writes, []);
  assert.deepEqual(log.uploads, []);
});

test('a sync publishes once and then has nothing to do', async () => {
  const { client, records, log } = fakeRepo();
  const first = await syncAtproto({
    client,
    writings: [note],
    fetchImage: png,
  });
  assert.equal(first.status, 'synced');
  assert.deepEqual(records.map((record) => record.collection).sort(), [
    DOCUMENT_COLLECTION,
    PUBLICATION_COLLECTION,
  ]);
  assert.equal(log.uploads.length, 1, 'icon and cover share bytes, one upload');

  const second = await syncAtproto({
    client,
    writings: [note],
    fetchImage: png,
  });
  assert.equal(second.status !== 'skipped' && second.unchanged, 2);
  assert.equal(log.writes.length, 2, 'no writes the second time');
});

test('unpublishing a writing deletes its record', async () => {
  const { client, records } = fakeRepo();
  await syncAtproto({ client, writings: [note], fetchImage: png });
  const report = await syncAtproto({ client, writings: [], fetchImage: png });
  assert.equal(report.status !== 'skipped' && report.deleted, 1);
  assert.deepEqual(
    records.map((record) => record.collection),
    [PUBLICATION_COLLECTION]
  );
});

test('a failed image fetch never strips a published image', async () => {
  const { client, records, log } = fakeRepo();
  await syncAtproto({ client, writings: [note], fetchImage: png });
  const published = JSON.stringify(records);
  assert.match(published, /coverImage/);
  assert.match(published, /"icon"/);

  const second = await syncAtproto({
    client,
    writings: [note],
    fetchImage: async () => null,
  });
  assert.equal(second.status, 'synced');
  assert.equal(second.status !== 'skipped' && second.unchanged, 2);
  assert.equal(log.writes.length, 2, 'no writes after the first sync');
  assert.equal(JSON.stringify(records), published);
});

test('a writing with an empty featuredImage covers itself with its generated image', async () => {
  const { client } = fakeRepo();
  const asked: string[] = [];
  await syncAtproto({
    client,
    dryRun: true,
    writings: [{ ...note, image: '' }],
    fetchImage: async (url) => {
      asked.push(url);
      return png();
    },
  });
  assert.ok(
    asked.includes(absoluteUrl(`${documentPath(note.slug)}/opengraph-image`)),
    `asked for ${asked.join(', ')}`
  );
});

test('a writing with a featuredImage covers itself with that image', async () => {
  const { client } = fakeRepo();
  const asked: string[] = [];
  await syncAtproto({
    client,
    dryRun: true,
    writings: [{ ...note, image: '/images/cover.png' }],
    fetchImage: async (url) => {
      asked.push(url);
      return png();
    },
  });
  assert.ok(asked.includes(absoluteUrl('/images/cover.png')));
});

test('a record its lexicon rejects is never published', async () => {
  const { client, records, log } = fakeRepo();
  const notAnImage = await localBlob(
    new TextEncoder().encode('<html></html>'),
    'text/html'
  );
  await assert.rejects(
    syncAtproto({
      client,
      writings: [note],
      fetchImage: async () => notAnImage,
    }),
    (error: Error) =>
      error.message.includes(PUBLICATION_COLLECTION) &&
      /MIME type/.test(error.message)
  );
  assert.deepEqual(log.writes, []);
  assert.deepEqual(log.uploads, []);
  assert.deepEqual(records, []);
});

test("a page's document link is the URI the sync creates", async () => {
  const { client } = fakeRepo();
  const report = await syncAtproto({
    client,
    dryRun: true,
    writings: [note],
    fetchImage: png,
  });
  assert.equal(report.status, 'planned');
  const writes = report.status !== 'skipped' ? report.writes : [];
  const [created] = writes.filter(
    (write) =>
      write.action === 'create' &&
      write.uri.includes(`/${DOCUMENT_COLLECTION}/`)
  );
  assert.equal(
    created.uri,
    documentUri(documentPath(note.slug), note.published)
  );
});

test('an explicit unrelated copy fails before any Standard record is published', async () => {
  const { client, log } = fakeRepo();
  const ref = {
    uri: `at://${site.author.atprotoDid}/app.bsky.feed.post/manual`,
    cid: 'bafyreifgg4ntz5pxvsdbaguqnz37qolup7kqlxztjaq5qy6cuddaptjcmi',
  };
  await assert.rejects(
    syncAtproto({
      client: {
        ...client,
        async getRecord() {
          return {
            ...ref,
            value: {
              $type: 'app.bsky.feed.post',
              text: 'Another post.',
              createdAt: note.published.toISOString(),
            },
          };
        },
      },
      writings: [{ ...note, atproto: { bskyPostRef: ref } }],
      fetchImage: png,
    }),
    /canonical writing/
  );
  assert.deepEqual(log.writes, []);
  assert.deepEqual(log.uploads, []);
});
