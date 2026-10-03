import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOCUMENT_COLLECTION,
  PUBLICATION_COLLECTION,
  publishingIdentity,
} from '@/lib/atproto/config';
import { planSync } from '@/lib/atproto/plan';
import type {
  DesiredRecord,
  ExistingRecord,
  LocalBlob,
} from '@/lib/atproto/types';

// The fixture identity from tests/unit/test.env.
const { publicationRkey: PUBLICATION_RKEY, publicationUri: PUBLICATION_URI } =
  publishingIdentity();

const cover: LocalBlob = {
  bytes: new Uint8Array([1]),
  ref: {
    $type: 'blob',
    ref: {
      $link: 'bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq',
    },
    mimeType: 'image/png',
    size: 1,
  },
};

function publication(): DesiredRecord {
  return {
    collection: PUBLICATION_COLLECTION,
    rkey: PUBLICATION_RKEY,
    value: {
      $type: 'site.standard.publication',
      name: 'Site',
      url: 'https://example.com',
    },
    blobs: [],
  };
}

function doc(rkey: string, path: string, title = 'Title'): DesiredRecord {
  return {
    collection: DOCUMENT_COLLECTION,
    rkey,
    value: {
      $type: 'site.standard.document',
      site: PUBLICATION_URI,
      path,
      title,
      publishedAt: '2026-10-01T00:00:00.000Z',
      coverImage: cover.ref,
    },
    blobs: [cover],
  };
}

/** What the PDS would list back after a record was written. */
function stored(record: DesiredRecord): ExistingRecord {
  return {
    collection: record.collection,
    rkey: record.rkey,
    cid: 'bafyrei-stored',
    value: JSON.parse(JSON.stringify(record.value)),
  };
}

const ref = {
  uri: 'at://did:plc:x/app.bsky.feed.post/3abc',
  cid: 'bafyrei-post',
};

test('an empty repo gets the publication and every document', () => {
  const plan = planSync(
    [publication(), doc('3mwa5ei54c22g', '/writings/a')],
    []
  );
  assert.deepEqual(
    plan.writes.map((write) => [write.$type, write.collection, write.rkey]),
    [
      [
        'com.atproto.repo.applyWrites#create',
        PUBLICATION_COLLECTION,
        PUBLICATION_RKEY,
      ],
      [
        'com.atproto.repo.applyWrites#create',
        DOCUMENT_COLLECTION,
        '3mwa5ei54c22g',
      ],
    ]
  );
  assert.equal(plan.uploads.length, 1, 'one cover, uploaded once');
  assert.equal(plan.unchanged, 0);
});

test('a record the PDS already holds is left alone, whatever its key order', () => {
  const want = doc('3mwa5ei54c22g', '/writings/a');
  const have = stored(want);
  have.value = Object.fromEntries(Object.entries(have.value).reverse());
  const plan = planSync([want], [have]);
  assert.deepEqual(plan.writes, []);
  assert.deepEqual(plan.uploads, []);
  assert.equal(plan.unchanged, 1);
});

test('a changed field updates the record in place', () => {
  const have = stored(doc('3mwa5ei54c22g', '/writings/a', 'Old title'));
  const plan = planSync(
    [doc('3mwa5ei54c22g', '/writings/a', 'New title')],
    [have]
  );
  assert.equal(plan.writes.length, 1);
  assert.equal(plan.writes[0].$type, 'com.atproto.repo.applyWrites#update');
});

test('a Bluesky post reference on the PDS survives every sync', () => {
  const want = doc('3mwa5ei54c22g', '/writings/a');
  const have = stored(want);
  have.value.bskyPostRef = ref;
  assert.equal(planSync([want], [have]).unchanged, 1);

  const edited = doc('3mwa5ei54c22g', '/writings/a', 'Edited');
  const [write] = planSync([edited], [have]).writes;
  assert.equal(write.$type, 'com.atproto.repo.applyWrites#update');
  assert.deepEqual(
    write.$type === 'com.atproto.repo.applyWrites#update' &&
      write.value.bskyPostRef,
    ref
  );
});

test('a new key for the same path moves the record and keeps its post', () => {
  const have = stored(doc('3mwa5ei54c22g', '/writings/a'));
  have.value.bskyPostRef = ref;
  const plan = planSync([doc('3mwb22222222a', '/writings/a')], [have]);
  assert.deepEqual(
    plan.writes.map((write) => [write.$type, write.rkey]),
    [
      ['com.atproto.repo.applyWrites#create', '3mwb22222222a'],
      ['com.atproto.repo.applyWrites#delete', '3mwa5ei54c22g'],
    ]
  );
  const [create] = plan.writes;
  assert.deepEqual(
    create.$type === 'com.atproto.repo.applyWrites#create' &&
      create.value.bskyPostRef,
    ref
  );
});

test("only this publication's documents are ever deleted", () => {
  const gone = stored(doc('3mwa5ei54c22g', '/writings/gone'));
  const leaflet: ExistingRecord = {
    ...stored(doc('3mwa5ei54c2hb', '/someone-else')),
    value: {
      ...gone.value,
      site: 'at://did:plc:x/site.standard.publication/3zzz',
    },
  };
  const otherPublication: ExistingRecord = {
    collection: PUBLICATION_COLLECTION,
    rkey: '3mvzzzzzzzzzz',
    cid: 'bafyrei-other',
    value: {
      $type: 'site.standard.publication',
      name: 'Leaflet',
      url: 'https://x.leaflet.pub',
    },
  };
  const plan = planSync([], [gone, leaflet, otherPublication]);
  assert.deepEqual(
    plan.writes.map((write) => [write.$type, write.rkey]),
    [['com.atproto.repo.applyWrites#delete', '3mwa5ei54c22g']]
  );
});

test('two writings that compute the same key stop the sync', () => {
  assert.throws(
    () =>
      planSync(
        [
          doc('3mwa5ei54c22g', '/writings/a'),
          doc('3mwa5ei54c22g', '/writings/b'),
        ],
        []
      ),
    /\/writings\/a.*\/writings\/b|\/writings\/b.*\/writings\/a/
  );
});
