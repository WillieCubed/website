import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  Webmention,
  WebmentionModerationStore,
} from '@/lib/indieweb/types';
import {
  formatPendingWebmention,
  handleListPendingWebmentions,
  handleModerateWebmention,
  isAuthorizedModerator,
  parseModerationCommand,
  parseModerationRequest,
  summarizePendingWebmention,
} from '@/lib/indieweb/webmention-moderation';
import { site } from '@/lib/site';

const SECRET = 'moderation-secret';
const VERIFIED_ID = '0b7c6f1e-2d4a-4c1b-9f3e-5a6b7c8d9e0f';
const UNVERIFIED_ID = '1c8d7a2f-3e5b-4d2c-8a4f-6b7c8d9e0f1a';
const ENDPOINT = `${site.origin}/api/webmention/moderate`;

const verified: Webmention = {
  id: VERIFIED_ID,
  sourceUrl: 'https://example.com/reply',
  targetUrl: `${site.origin}/writings/original-post`,
  type: 'reply',
  author: { name: 'Ada', url: 'https://example.com' },
  content: 'A thoughtful\n  reply.',
  receivedAt: new Date('2026-09-20T12:00:00Z'),
  verifiedAt: new Date('2026-09-20T12:00:05Z'),
  isVerified: true,
  isApproved: false,
};

const unverified: Webmention = {
  id: UNVERIFIED_ID,
  sourceUrl: 'https://spam.example/post',
  targetUrl: `${site.origin}/writings/original-post`,
  type: 'mention',
  author: {},
  receivedAt: new Date('2026-09-21T08:00:00Z'),
  isVerified: false,
  isApproved: false,
};

/**
 * An in-memory store with the same rules as the Postgres one: only verified,
 * unrejected mentions approve, and rejecting twice changes nothing.
 */
function memoryStore(rows: Webmention[]) {
  const state = new Map(
    rows.map((row) => [row.id, { row: { ...row }, rejected: false }])
  );
  const store: WebmentionModerationStore = {
    async listPending() {
      return [...state.values()]
        .filter(({ row, rejected }) => !row.isApproved && !rejected)
        .map(({ row }) => row);
    },
    async approve(id) {
      const entry = state.get(id);
      if (!entry || entry.rejected || !entry.row.isVerified) return false;
      entry.row.isApproved = true;
      return true;
    },
    async reject(id) {
      const entry = state.get(id);
      if (!entry || entry.rejected) return false;
      entry.rejected = true;
      entry.row.isApproved = false;
      return true;
    },
  };
  return { store, state };
}

function request(
  method: 'GET' | 'POST',
  { token = SECRET, body }: { token?: string | null; body?: unknown } = {}
): Request {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token !== null) headers.set('Authorization', `Bearer ${token}`);
  return new Request(ENDPOINT, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test('isAuthorizedModerator accepts only the exact bearer secret', () => {
  assert.equal(isAuthorizedModerator(`Bearer ${SECRET}`, SECRET), true);
  assert.equal(isAuthorizedModerator(`Bearer ${SECRET}x`, SECRET), false);
  assert.equal(isAuthorizedModerator(SECRET, SECRET), false);
  assert.equal(isAuthorizedModerator(null, SECRET), false);
});

test('parseModerationRequest requires a known action and a UUID id', () => {
  assert.deepEqual(
    parseModerationRequest({ action: 'approve', id: VERIFIED_ID }),
    { action: 'approve', id: VERIFIED_ID }
  );
  assert.equal(
    parseModerationRequest({ action: 'delete', id: VERIFIED_ID }),
    null
  );
  assert.equal(parseModerationRequest({ action: 'reject', id: '42' }), null);
  assert.equal(parseModerationRequest(null), null);
});

test('the moderation route answers 503 until a secret is configured', async () => {
  const { store } = memoryStore([verified]);
  const response = await handleListPendingWebmentions(request('GET'), {
    store,
    secret: undefined,
  });
  assert.equal(response.status, 503);
});

test('the moderation route refuses a missing or wrong bearer token', async () => {
  const { store } = memoryStore([verified]);
  const options = { store, secret: SECRET };

  const missing = await handleListPendingWebmentions(
    request('GET', { token: null }),
    options
  );
  const wrong = await handleModerateWebmention(
    request('POST', {
      token: 'guess',
      body: { action: 'approve', id: VERIFIED_ID },
    }),
    options
  );

  assert.equal(missing.status, 401);
  assert.equal(wrong.status, 401);
  assert.equal((await store.listPending()).length, 1);
});

test('GET lists pending webmentions without caching them', async () => {
  const { store } = memoryStore([verified, unverified]);
  const response = await handleListPendingWebmentions(request('GET'), {
    store,
    secret: SECRET,
  });
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(json.count, 2);
  assert.deepEqual(
    json.pending.map((mention: { id: string }) => mention.id),
    [VERIFIED_ID, UNVERIFIED_ID]
  );
  assert.equal(json.pending[0].author, 'Ada');
  assert.equal(json.pending[1].verified, false);
});

test('POST approves a verified webmention and it leaves the queue', async () => {
  const { store, state } = memoryStore([verified, unverified]);
  const response = await handleModerateWebmention(
    request('POST', { body: { action: 'approve', id: VERIFIED_ID } }),
    { store, secret: SECRET }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    id: VERIFIED_ID,
    status: 'approved',
  });
  assert.equal(state.get(VERIFIED_ID)?.row.isApproved, true);
  assert.deepEqual(
    (await store.listPending()).map((mention) => mention.id),
    [UNVERIFIED_ID]
  );
});

test('POST will not approve an unverified webmention', async () => {
  const { store, state } = memoryStore([unverified]);
  const response = await handleModerateWebmention(
    request('POST', { body: { action: 'approve', id: UNVERIFIED_ID } }),
    { store, secret: SECRET }
  );

  assert.equal(response.status, 404);
  assert.equal(state.get(UNVERIFIED_ID)?.row.isApproved, false);
});

test('POST rejects a webmention once', async () => {
  const { store } = memoryStore([unverified]);
  const options = { store, secret: SECRET };
  const body = { action: 'reject', id: UNVERIFIED_ID };

  const first = await handleModerateWebmention(
    request('POST', { body }),
    options
  );
  const second = await handleModerateWebmention(
    request('POST', { body }),
    options
  );

  assert.equal(first.status, 200);
  assert.equal((await first.json()).status, 'rejected');
  assert.equal(second.status, 404);
  assert.equal((await store.listPending()).length, 0);
});

test('POST answers 400 to a body it cannot read', async () => {
  const { store } = memoryStore([verified]);
  const response = await handleModerateWebmention(
    request('POST', { body: { action: 'approve' } }),
    { store, secret: SECRET }
  );
  assert.equal(response.status, 400);
});

test('parseModerationCommand reads the CLI arguments', () => {
  assert.deepEqual(parseModerationCommand([]), { command: 'list' });
  assert.deepEqual(parseModerationCommand(['list']), { command: 'list' });
  assert.deepEqual(parseModerationCommand(['approve', VERIFIED_ID]), {
    command: 'approve',
    ids: [VERIFIED_ID],
  });
  assert.deepEqual(
    parseModerationCommand(['reject', VERIFIED_ID, UNVERIFIED_ID]),
    { command: 'reject', ids: [VERIFIED_ID, UNVERIFIED_ID] }
  );
  assert.ok('error' in parseModerationCommand(['approve']));
  assert.ok('error' in parseModerationCommand(['approve', 'not-an-id']));
  assert.ok('error' in parseModerationCommand(['publish', VERIFIED_ID]));
  assert.ok('error' in parseModerationCommand(['list', VERIFIED_ID]));
});

test('formatPendingWebmention prints what a moderator needs to decide', () => {
  const printed = formatPendingWebmention(summarizePendingWebmention(verified));
  assert.match(printed, new RegExp(`^${VERIFIED_ID}  reply$`, 'm'));
  assert.match(printed, /from {4}https:\/\/example\.com\/reply/);
  assert.match(printed, /says {4}A thoughtful reply\./);

  const flagged = formatPendingWebmention(
    summarizePendingWebmention(unverified)
  );
  assert.match(flagged, /mention \(unverified\)/);
  assert.doesNotMatch(flagged, /author/);
});
