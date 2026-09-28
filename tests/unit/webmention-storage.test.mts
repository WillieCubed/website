import { VercelPool } from '@vercel/postgres';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';

import { getWebmentionsForTarget } from '@/lib/indieweb/webmention-storage';
import { site } from '@/lib/site';

// `sql` builds its pool lazily from POSTGRES_URL, so a localhost address is
// enough to reach the stubbed query below without a database.
process.env.POSTGRES_URL = 'postgres://test@localhost:5432/test';

const target = `${site.origin}/writings/hello`;

function row(overrides: Record<string, unknown>) {
  return {
    id: crypto.randomUUID(),
    source_url: 'https://example.com/post',
    target_url: target,
    type: 'mention',
    author_name: null,
    author_url: null,
    author_photo: null,
    rsvp: null,
    name: null,
    content: null,
    published_at: null,
    received_at: '2026-09-20T12:00:00Z',
    verified_at: '2026-09-20T12:00:05Z',
    is_verified: true,
    is_approved: true,
    ...overrides,
  };
}

let rows: Record<string, unknown>[] = [];

beforeEach(() => {
  mock.method(VercelPool.prototype, 'sql', async () => ({
    rows,
    rowCount: rows.length,
  }));
});

afterEach(() => mock.restoreAll());

test('a cited post keeps its title only when the title is not its text again', async () => {
  rows = [
    row({ id: 'article', name: 'On buses', content: 'Buses are good.' }),
    row({
      id: 'note',
      name: 'Buses are  good.\nReally.',
      content: 'Buses are good. Really.',
    }),
    row({ id: 'prefix', name: 'Buses', content: 'Buses are good.' }),
    row({ id: 'untitled', content: 'Buses are good.' }),
  ];
  const { mentions } = await getWebmentionsForTarget(target);
  assert.deepEqual(
    mentions.map((mention) => [mention.id, mention.name]),
    [
      ['article', 'On buses'],
      ['note', undefined],
      ['prefix', undefined],
      ['untitled', undefined],
    ]
  );
});

test('RSVPs are grouped with their answers', async () => {
  rows = [
    row({ id: 'going', type: 'rsvp', rsvp: 'yes' }),
    row({ id: 'reply', type: 'reply', content: 'Hi.' }),
  ];
  const { rsvps, replies } = await getWebmentionsForTarget(target);
  assert.deepEqual(
    rsvps.map((rsvp) => [rsvp.id, rsvp.rsvp]),
    [['going', 'yes']]
  );
  assert.deepEqual(
    replies.map((reply) => [reply.id, reply.rsvp]),
    [['reply', undefined]]
  );
});
