import assert from 'node:assert/strict';
import test from 'node:test';

import { detailEntry, detailMetadata } from '@/lib/home/detail-metadata';
import { entries } from '@/lib/home/ventures';
import { site } from '@/lib/site';

type Loose = Record<string, unknown>;

test('every detail view gets its own title, description, and og:url', () => {
  for (const [id, entry] of Object.entries(entries)) {
    const meta = detailMetadata(id);
    assert.ok(meta, `${id} has metadata`);
    assert.deepEqual(meta.title, {
      absolute: `${entry.name} · ${site.name}`,
    });
    assert.equal(meta.description, entry.detail.body[0]);
    const openGraph = meta.openGraph as Loose;
    assert.equal(openGraph.title, entry.name);
    assert.equal(openGraph.url, `/?detail=${id}`);
    assert.equal((meta.twitter as Loose).title, entry.name);
  }
});

test('the launch ventures are covered', () => {
  for (const id of ['lvbt', 'transitmapper', 'hypertext', 'rtc']) {
    assert.ok(detailMetadata(id), `${id} has metadata`);
  }
});

test('a detail view keeps the homepage as its canonical', () => {
  assert.deepEqual(detailMetadata('lvbt')?.alternates, { canonical: '/' });
});

test('a missing, unknown, or hidden id falls back to the homepage', () => {
  assert.equal(detailMetadata(undefined), null);
  assert.equal(detailMetadata(''), null);
  assert.equal(detailMetadata('nope'), null);
  assert.equal(detailMetadata('atlas'), null);
});

test('prototype keys do not resolve to an entry', () => {
  for (const id of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(detailEntry(id), undefined, id);
    assert.equal(detailMetadata(id), null, id);
  }
});
