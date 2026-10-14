import assert from 'node:assert/strict';
import test from 'node:test';

import {
  invalidatePublicWebmentionSnapshot,
  readPublicWebmentionSnapshot,
} from '@/lib/indieweb/webmention/snapshot';
import type { Webmention } from '@/lib/indieweb/webmention/types';

function mention(id: string): Webmention {
  return {
    id,
    sourceUrl: `https://source.example/${id}`,
    targetUrl: `https://willie.page/writings/${id}`,
    type: 'reply',
    author: { name: 'Reader' },
    publishedAt: new Date('2026-10-13T12:00:00Z'),
    receivedAt: new Date('2026-10-13T12:01:00Z'),
    verifiedAt: new Date('2026-10-13T12:02:00Z'),
    isVerified: true,
    isApproved: true,
  };
}

function memoryBucket() {
  const objects = new Map<string, string>();
  return {
    async get(key: string) {
      const value = objects.get(key);
      return value === undefined ? null : { text: async () => value };
    },
    async put(key: string, value: string) {
      objects.set(key, value);
    },
    async delete(key: string) {
      objects.delete(key);
    },
  };
}

test('one R2 snapshot serves repeat public reads without waking Postgres', async () => {
  const bucket = memoryBucket();
  const now = Date.parse('2026-10-13T12:00:00Z');
  let loads = 0;
  const load = async () => {
    loads++;
    return [mention('first'), mention('second')];
  };

  const first = await readPublicWebmentionSnapshot(bucket, load, now);
  const second = await readPublicWebmentionSnapshot(bucket, load, now + 60_000);
  assert.equal(loads, 1);
  assert.deepEqual(
    second.map((item) => item.id),
    ['first', 'second']
  );
  assert.equal(first[0].receivedAt.getTime(), second[0].receivedAt.getTime());
  assert.ok(second[0].publishedAt instanceof Date);
  assert.ok(second[0].verifiedAt instanceof Date);

  await readPublicWebmentionSnapshot(bucket, load, now + 60 * 60_000);
  assert.equal(loads, 2);
});

test('invalidation makes the next public read see an approved change', async () => {
  const bucket = memoryBucket();
  let visible = [mention('first')];
  const load = async () => visible;
  const now = Date.parse('2026-10-13T12:00:00Z');
  await readPublicWebmentionSnapshot(bucket, load, now);
  visible = [...visible, mention('second')];
  assert.equal(
    (await readPublicWebmentionSnapshot(bucket, load, now + 1000)).length,
    1
  );
  await invalidatePublicWebmentionSnapshot(bucket);
  assert.equal(
    (await readPublicWebmentionSnapshot(bucket, load, now + 2000)).length,
    2
  );
});

test('an in-flight old read cannot restore a snapshot after invalidation', async () => {
  const bucket = memoryBucket();
  const now = Date.parse('2026-10-13T12:00:00Z');
  let releaseOld!: () => void;
  let oldStarted!: () => void;
  const oldMayFinish = new Promise<void>((resolve) => (releaseOld = resolve));
  const oldIsLoading = new Promise<void>((resolve) => (oldStarted = resolve));
  const oldRead = readPublicWebmentionSnapshot(
    bucket,
    async () => {
      oldStarted();
      await oldMayFinish;
      return [mention('old')];
    },
    now
  );
  await oldIsLoading;
  await invalidatePublicWebmentionSnapshot(bucket);
  releaseOld();
  await oldRead;

  let freshLoads = 0;
  const latest = await readPublicWebmentionSnapshot(
    bucket,
    async () => {
      freshLoads++;
      return [mention('new')];
    },
    now + 1000
  );
  assert.equal(freshLoads, 1);
  assert.deepEqual(
    latest.map((item) => item.id),
    ['new']
  );
});

test('missing R2 binding reads directly from Postgres', async () => {
  let loads = 0;
  const load = async () => {
    loads++;
    return [mention('first')];
  };
  await readPublicWebmentionSnapshot(undefined, load);
  await readPublicWebmentionSnapshot(undefined, load);
  assert.equal(loads, 2);
});
