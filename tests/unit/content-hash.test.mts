import { VercelPool } from '@vercel/postgres';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';

import {
  getOutgoingWebmentions,
  hasContentChanged,
  hashContent,
  markForResend,
  trackOutgoingWebmention,
  updateOutgoingWebmentionStatus,
} from '@/lib/indieweb/content-hash';

// `sql` builds its pool lazily from POSTGRES_URL, so a localhost address is
// enough to reach the stubbed query below without a database.
process.env.POSTGRES_URL = 'postgres://test@localhost:5432/test';

interface Query {
  text: string;
  values: unknown[];
}

let queries: Query[] = [];
let respond: (query: Query) => { rows: unknown[]; rowCount?: number | null };

beforeEach(() => {
  queries = [];
  respond = () => ({ rows: [], rowCount: 0 });
  mock.method(
    VercelPool.prototype,
    'sql',
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = { text: strings.join('?'), values };
      queries.push(query);
      return respond(query);
    }
  );
});

afterEach(() => mock.restoreAll());

test('content hashes are SHA-256 hex digests', () => {
  assert.equal(
    hashContent(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
  assert.equal(
    hashContent('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
  assert.notEqual(hashContent('abc'), hashContent('abd'));
});

test('a post that was never sent counts as changed', async () => {
  assert.equal(await hasContentChanged('hello', 'Hello.'), true);
  assert.deepEqual(queries[0].values, ['hello']);
});

test('a post whose stored hash matches has not changed', async () => {
  respond = () => ({ rows: [{ content_hash: hashContent('Hello.') }] });
  assert.equal(await hasContentChanged('hello', 'Hello.'), false);
  assert.equal(await hasContentChanged('hello', 'Hello, again.'), true);
});

test('tracking a sent webmention records the send time and returns its id', async () => {
  respond = () => ({ rows: [{ id: 'row-1' }] });
  const id = await trackOutgoingWebmention(
    'https://willie.page/writings/hello',
    'https://example.com/post',
    'hello',
    'abc123',
    'sent'
  );
  assert.equal(id, 'row-1');
  const [source, target, slug, hash, status, sentAt] = queries[0].values;
  assert.deepEqual(
    [source, target, slug, hash, status],
    [
      'https://willie.page/writings/hello',
      'https://example.com/post',
      'hello',
      'abc123',
      'sent',
    ]
  );
  assert.equal(typeof sentAt, 'string');
});

test('a pending webmention is tracked without a send time', async () => {
  respond = () => ({ rows: [{ id: 'row-2' }] });
  await trackOutgoingWebmention(
    'https://willie.page/writings/hello',
    'https://example.com/post',
    'hello',
    'abc123'
  );
  assert.deepEqual(queries[0].values.slice(4), ['pending', null]);
});

test('outgoing webmentions are read back with dates', async () => {
  respond = () => ({
    rows: [
      {
        id: 'row-1',
        source_url: 'https://willie.page/writings/hello',
        target_url: 'https://example.com/post',
        content_hash: 'abc123',
        status: 'sent',
        sent_at: '2026-09-01T12:00:00.000Z',
      },
      {
        id: 'row-2',
        source_url: 'https://willie.page/writings/hello',
        target_url: 'https://example.org/',
        content_hash: 'abc123',
        status: 'no_endpoint',
        sent_at: null,
      },
    ],
  });
  const [sent, unsent] = await getOutgoingWebmentions('hello');
  assert.equal(sent.targetUrl, 'https://example.com/post');
  assert.deepEqual(sent.sentAt, new Date('2026-09-01T12:00:00.000Z'));
  assert.equal(unsent.status, 'no_endpoint');
  assert.equal(unsent.sentAt, null);
});

test('only a sent status stamps the send time', async () => {
  await updateOutgoingWebmentionStatus('row-1', 'sent');
  await updateOutgoingWebmentionStatus('row-1', 'failed');
  assert.match(queries[0].text, /sent_at = NOW\(\)/);
  assert.doesNotMatch(queries[1].text, /sent_at/);
});

test('marking for resend reports how many rows changed', async () => {
  respond = () => ({ rows: [], rowCount: 3 });
  assert.equal(await markForResend('hello'), 3);
  respond = () => ({ rows: [], rowCount: null });
  assert.equal(await markForResend('hello'), 0);
});
