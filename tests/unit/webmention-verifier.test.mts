import { VercelPool } from '@vercel/postgres';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';

import { verifyWebmention } from '@/lib/indieweb/webmention-verifier';
import { site } from '@/lib/site';

// `sql` builds its pool lazily from POSTGRES_URL, so a localhost address is
// enough to reach the stubbed query below without a database.
process.env.POSTGRES_URL = 'postgres://test@localhost:5432/test';

const source = 'https://example.com/replies/1';
const target = `${site.origin}/writings/hello`;

interface Query {
  text: string;
  values: unknown[];
}

let queries: Query[] = [];
let fetched: string[] = [];

/** Serve `body` with `status` for the source, and record every fetch. */
function serveSource(body: string, status = 200) {
  mock.method(globalThis, 'fetch', async (input: string | URL) => {
    fetched.push(String(input));
    return new Response(body, {
      status,
      headers: { 'Content-Type': 'text/html' },
    });
  });
}

beforeEach(() => {
  queries = [];
  fetched = [];
  mock.method(
    VercelPool.prototype,
    'sql',
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      queries.push({ text: strings.join('?'), values });
      return { rows: [], rowCount: 1 };
    }
  );
});

afterEach(() => mock.restoreAll());

const softDeletes = () =>
  queries.filter((query) => /is_deleted = TRUE/.test(query.text));
const verifications = () =>
  queries.filter((query) => /is_verified = TRUE/.test(query.text));

test('a reply marked up as an h-entry is verified with its author and content', async () => {
  serveSource(`
    <article class="h-entry">
      <div class="p-author h-card">
        <img class="u-photo" src="/me.jpg" alt="">
        <a class="p-name u-url" href="https://example.com/">Ada Lovelace</a>
      </div>
      <a class="u-in-reply-to" href="${target}">In reply to</a>
      <div class="e-content">Great <b>post</b>!<script>alert(1)</script></div>
      <time class="dt-published" datetime="2026-09-01T12:00:00Z"></time>
    </article>
  `);

  const result = await verifyWebmention('wm-1', source, target);

  assert.equal(result.success, true);
  assert.equal(result.type, 'reply');
  assert.deepEqual(result.author, {
    name: 'Ada Lovelace',
    url: 'https://example.com/',
    photo: 'https://example.com/me.jpg',
  });
  assert.equal(result.content, 'Great post!');
  assert.deepEqual(result.publishedAt, new Date('2026-09-01T12:00:00Z'));
  assert.deepEqual(fetched, [source]);

  const [update] = verifications();
  assert.ok(update, 'the row is marked verified');
  assert.equal(update.values[0], 'reply');
  assert.equal(update.values.at(-1), 'wm-1');
});

test('likes and reposts are told apart from replies', async () => {
  serveSource(
    `<div class="h-entry"><a class="u-like-of" href="${target}">Liked</a></div>`
  );
  assert.equal((await verifyWebmention('wm-1', source, target)).type, 'like');

  serveSource(
    `<div class="h-entry"><a class="u-repost-of" href="${target}">Reposted</a></div>`
  );
  assert.equal((await verifyWebmention('wm-1', source, target)).type, 'repost');
});

test('a page that links without an h-entry is a plain mention', async () => {
  serveSource(`<p>Read <a href="${target}">this</a>.</p>`);
  const result = await verifyWebmention('wm-1', source, target);
  assert.deepEqual(result, { success: true, type: 'mention' });
  assert.equal(verifications().length, 1);
});

test('a source that no longer links to the target deletes the mention', async () => {
  serveSource(
    `<p>Read <a href="${site.origin}/writings/hello-world">this</a>.</p>`
  );
  const result = await verifyWebmention('wm-1', source, target);
  assert.equal(result.isDeleted, true);
  assert.equal(result.error, 'Source no longer links to target');
  assert.deepEqual(softDeletes()[0].values, ['wm-1']);
});

test('a source that is gone or missing deletes the mention', async () => {
  for (const status of [410, 404]) {
    queries = [];
    serveSource('', status);
    const result = await verifyWebmention('wm-1', source, target);
    assert.equal(result.success, true);
    assert.equal(result.isDeleted, true);
    assert.match(result.error ?? '', new RegExp(String(status)));
    assert.equal(softDeletes().length, 1);
  }
});

test('a source that errors fails without touching the stored mention', async () => {
  serveSource('Server error', 500);
  const result = await verifyWebmention('wm-1', source, target);
  assert.deepEqual(result, {
    success: false,
    error: 'Failed to fetch source: 500',
  });
  assert.equal(queries.length, 0);
});

test('a source that cannot be reached fails with the network error', async () => {
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('getaddrinfo ENOTFOUND example.com');
  });
  const result = await verifyWebmention('wm-1', source, target);
  assert.deepEqual(result, {
    success: false,
    error: 'getaddrinfo ENOTFOUND example.com',
  });
  assert.equal(queries.length, 0);
});

test('mentions from this site or to another site are refused unfetched', async () => {
  serveSource(`<a href="${target}">self</a>`);

  const self = await verifyWebmention(
    'wm-1',
    `${site.origin}/writings/other`,
    target
  );
  assert.deepEqual(self, {
    success: false,
    error: 'Self-mentions not allowed',
  });

  const offsite = await verifyWebmention(
    'wm-1',
    source,
    'https://example.org/post'
  );
  assert.deepEqual(offsite, {
    success: false,
    error: 'Target is not on this site',
  });

  const invalid = await verifyWebmention('wm-1', 'not a url', target);
  assert.equal(invalid.success, false);

  assert.deepEqual(fetched, []);
  assert.equal(queries.length, 0);
});
