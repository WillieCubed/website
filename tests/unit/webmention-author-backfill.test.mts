import { mf2 } from 'microformats-parser';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import type { WebmentionAuthorBackfillStore } from '@/lib/indieweb/types';
import {
  backfillWebmentionAuthorPhotos,
  formatAuthorBackfillResult,
} from '@/lib/indieweb/webmention-author-backfill';

const SCRIPT = fileURLToPath(
  new URL('../../scripts/backfill-webmention-authors.mts', import.meta.url)
);

const WITH_ALT = '0b7c6f1e-2d4a-4c1b-9f3e-5a6b7c8d9e0f';
const NO_PHOTO = '1c8d7a2f-3e5b-4d2c-8a4f-6b7c8d9e0f1a';
const NO_ENTRY = '2d9e8b3a-4f6c-4e3d-9b5a-7c8d9e0f1a2b';
const HAS_PHOTO = '3eaf9c4b-5a7d-4f4e-8c6b-8d9e0f1a2b3c';

/** The first h-entry parsed from `html`, as the verifier stored it. */
function entry(html: string) {
  const [item] = mf2(html, { baseUrl: 'https://example.com/replies/1' }).items;
  assert.ok(item, 'the markup parses to an h-entry');
  return item;
}

interface Row {
  id: string;
  isVerified: boolean;
  authorPhoto: string | null;
  rawMf2: unknown;
}

/**
 * An in-memory store with the same rules as the Postgres one: it lists
 * verified rows with no photo, and sets a photo only where there is none.
 * It leaves `{}` entries in the list so the backfill's own check is tested.
 */
function memoryStore(rows: Row[]) {
  const state = new Map(rows.map((row) => [row.id, { ...row }]));
  const writes: string[] = [];
  const store: WebmentionAuthorBackfillStore = {
    async listMissingPhotos() {
      return [...state.values()]
        .filter((row) => row.isVerified && row.authorPhoto === null)
        .map(({ id, rawMf2 }) => ({ id, rawMf2 }));
    },
    async setPhoto(id, photo) {
      const row = state.get(id);
      if (!row || row.authorPhoto !== null) return false;
      row.authorPhoto = photo;
      writes.push(id);
      return true;
    },
  };
  return { store, state, writes };
}

function fixtures(): Row[] {
  return [
    {
      id: WITH_ALT,
      isVerified: true,
      authorPhoto: null,
      rawMf2: entry(`
        <article class="h-entry">
          <div class="p-author h-card">
            <img class="u-photo" src="/me.jpg" alt="Ada, smiling">
            <a class="p-name u-url" href="https://example.com/">Ada</a>
          </div>
        </article>
      `),
    },
    {
      id: NO_PHOTO,
      isVerified: true,
      authorPhoto: null,
      rawMf2: entry(
        `<article class="h-entry"><span class="p-author">Grace</span></article>`
      ),
    },
    { id: NO_ENTRY, isVerified: true, authorPhoto: null, rawMf2: {} },
    {
      id: HAS_PHOTO,
      isVerified: true,
      authorPhoto: 'https://example.org/kept.jpg',
      rawMf2: entry(`
        <article class="h-entry">
          <div class="p-author h-card">
            <img class="u-photo" src="https://example.org/other.jpg" alt="x">
            <span class="p-name">Katherine</span>
          </div>
        </article>
      `),
    },
  ];
}

test('the backfill fills a photo that had alt text from the stored entry', async () => {
  const { store, state } = memoryStore(fixtures());
  const result = await backfillWebmentionAuthorPhotos(store);

  assert.deepEqual(result.filled, [
    { id: WITH_ALT, photo: 'https://example.com/me.jpg' },
  ]);
  assert.equal(state.get(WITH_ALT)?.authorPhoto, 'https://example.com/me.jpg');
});

test('the backfill leaves mentions whose entry names no photo alone', async () => {
  const { store, state } = memoryStore(fixtures());
  const result = await backfillWebmentionAuthorPhotos(store);

  assert.deepEqual(result.skipped, [NO_PHOTO, NO_ENTRY]);
  assert.equal(state.get(NO_PHOTO)?.authorPhoto, null);
  assert.equal(state.get(NO_ENTRY)?.authorPhoto, null);
  assert.equal(
    state.get(HAS_PHOTO)?.authorPhoto,
    'https://example.org/kept.jpg'
  );
});

test('a second backfill run changes nothing', async () => {
  const { store, state, writes } = memoryStore(fixtures());
  await backfillWebmentionAuthorPhotos(store);
  const before = structuredClone([...state.entries()]);

  const second = await backfillWebmentionAuthorPhotos(store);

  assert.deepEqual(second.filled, []);
  assert.deepEqual(writes, [WITH_ALT]);
  assert.deepEqual([...state.entries()], before);
});

test('the backfill summary names each filled photo and the count left', () => {
  assert.equal(
    formatAuthorBackfillResult({
      filled: [{ id: WITH_ALT, photo: 'https://example.com/me.jpg' }],
      skipped: [NO_PHOTO],
    }),
    [
      `filled ${WITH_ALT}  https://example.com/me.jpg`,
      'Filled 1 author photo.',
      'Left 1 without a photo: the stored entry names none.',
    ].join('\n')
  );
  assert.equal(
    formatAuthorBackfillResult({ filled: [], skipped: [] }),
    'No webmention was missing an author photo its entry names.'
  );
});

test('the backfill script does nothing without a database', () => {
  const env = { ...process.env };
  delete env.POSTGRES_URL;
  delete env.DATABASE_URL;

  const output = execFileSync(process.execPath, ['--import', 'tsx', SCRIPT], {
    env,
    encoding: 'utf8',
  });

  assert.match(output, /set POSTGRES_URL/);
  assert.match(output, /Nothing changed\./);
});
