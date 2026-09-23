import assert from 'node:assert/strict';
import test from 'node:test';

import { entityKey } from '@/lib/entities/key';
import { VENTURE_CARDS } from '@/lib/entities/ventures';
import { entries, products, ventures } from '@/lib/home/ventures';

test('every shown venture and product has a card keyed by its detail view', () => {
  const hrefs = VENTURE_CARDS.map((card) => card.href);
  assert.deepEqual(
    hrefs.toSorted(),
    Object.keys(entries)
      .map((id) => `/?detail=${id}`)
      .toSorted()
  );
  for (const venture of ventures.filter((v) => v.hidden)) {
    assert.ok(!hrefs.includes(`/?detail=${venture.id}`), `${venture.id}`);
  }
});

test('venture cards carry their kind, brand seed, and parent', () => {
  const docket = VENTURE_CARDS.find((c) => c.href === '/?detail=docket');
  assert.equal(docket?.kind, 'product');
  assert.match(docket?.brand ?? '', /^#[0-9a-f]{6}$/i);
  assert.equal(docket?.meta, products.docket.parent);
  const lvbt = VENTURE_CARDS.find((c) => c.href === '/?detail=lvbt');
  assert.equal(lvbt?.kind, 'venture');
  assert.equal(lvbt?.cover, undefined, 'a countdown has no cover');
});

test('entityKey keeps the homepage detail query and drops every other one', () => {
  assert.equal(entityKey('/?detail=lvbt'), '/?detail=lvbt');
  assert.equal(entityKey('/?detail=lvbt&x=1#top'), '/?detail=lvbt');
  assert.equal(
    entityKey('https://willie.page/?detail=docket'),
    '/?detail=docket'
  );
  assert.equal(entityKey('/?q=transit'), '/');
  assert.equal(entityKey('/writings/?detail=x'), '/writings');
  assert.equal(
    entityKey('https://willie.page/writings/hello/'),
    '/writings/hello'
  );
  assert.equal(entityKey('/'), '/');
});
