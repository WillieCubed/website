import assert from 'node:assert/strict';
import test from 'node:test';

import {
  overlayReadings,
  readingWritingData,
  safeReadingHtml,
} from '@/lib/studio/reading';
import type { Draft } from '@/lib/studio/types';
import type { WritingData } from '@/lib/writings';

const writing = {
  slug: 'transit',
  title: 'Public title',
  description: 'Public description',
  tags: ['public'],
  published: new Date('2026-09-01'),
  hasExplicitTitle: true,
  draft: false,
  series: { slug: 'cities', part: 1 },
} as WritingData;
const draft: Draft = {
  id: 'document',
  slug: 'transit',
  liveRevisionId: null,
  deletedAt: null,
  head: {
    id: 'private-head',
    number: 1,
    documentId: 'document',
    createdAt: '2026-10-10T00:00:00Z',
    body: {
      title: 'Private title',
      description: 'Private description',
      tags: ['private'],
      postType: 'article',
      document: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Private body.' }],
          },
        ],
      },
    },
  },
};

test('private reading overlays the public entry once and retains series/date without mutating either input', () => {
  const entries = overlayReadings([writing], [draft]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'Private title');
  assert.equal(entries[0].source, 'Private body.');
  assert.deepEqual(entries[0].tags, ['private']);
  assert.deepEqual(entries[0].series, writing.series);
  assert.equal(entries[0].date.toISOString(), '2026-09-01T00:00:00.000Z');
  assert.equal(entries[0].status, 'Unpublished changes');
  assert.equal(entries[0].editorId, 'document');
  assert.equal(writing.title, 'Public title');
});

test('new private and filesystem drafts have quiet draft states while exact live revision does not', () => {
  assert.equal(overlayReadings([], [draft])[0].status, 'Draft');
  assert.equal(
    overlayReadings([{ ...writing, draft: true }], [])[0].status,
    'Draft'
  );
  assert.equal(
    overlayReadings([], [{ ...draft, liveRevisionId: draft.head.id }])[0]
      .status,
    null
  );
  assert.equal(
    overlayReadings([], [{ ...draft, deletedAt: '2026-10-10' }]).length,
    0
  );
});

test('private portable reading renders prose without evaluating MDX or accepting unsafe URLs', async () => {
  const html = await safeReadingHtml(
    '## Private idea\n\nSome **prose** and [unsafe](javascript:alert%281%29).\n\n{process.exit(1)}',
    '/writings/transit'
  );
  assert.match(html, /<h2>Private idea<\/h2>/);
  assert.match(html, /<strong>prose<\/strong>/);
  assert.doesNotMatch(html, /javascript:|process.exit|<script/);
  assert.match(html, /Interactive content/);
});

test('private generated blocks render their portable prose without loading the interactive document', async () => {
  const portable = Buffer.from('A chart with **four routes**.').toString(
    'base64url'
  );
  const html = await safeReadingHtml(
    `<StudioBlock id="chart" src="/generated-blocks/chart.html" portable="${portable}" />`,
    '/writings/transit'
  );
  assert.match(html, /four routes/);
  assert.doesNotMatch(html, /iframe|generated-blocks|script/);
});

test('native private cards and headers preserve note semantics and derive their title from prose', () => {
  const note = structuredClone(draft);
  note.head.body.title = '';
  note.head.body.postType = 'note';
  const entry = overlayReadings([], [note])[0];
  assert.equal(entry.title, 'Private body.');
  const native = readingWritingData(entry);
  assert.equal(native.hasExplicitTitle, false);
  assert.equal(native.postType, 'note');
  assert.equal(
    readingWritingData({
      ...entry,
      title: 'Retained earlier title',
      hasExplicitTitle: true,
    }).hasExplicitTitle,
    false
  );
  assert.equal(
    readingWritingData(entry, { ...writing, readingTime: 100 }).readingTime,
    1
  );
  assert.equal(native.draft, true);
  assert.equal(native.readingTime, 1);
  assert.deepEqual(native.people, []);
  assert.equal(
    readingWritingData(overlayReadings([writing], [draft])[0], writing)
      .hasExplicitTitle,
    true
  );
});
