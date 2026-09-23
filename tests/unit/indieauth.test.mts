import assert from 'node:assert/strict';
import test from 'node:test';

import { getBearerToken, verifyIndieAuthToken } from '@/lib/indieweb/indieauth';
import { hashSecret } from '@/lib/indieweb/indieauth-server';
import type { IndieAuthTokenRecord } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

import { memoryIndieAuthStore } from './indieauth-memory-store.mts';

const NOW = new Date('2026-09-22T12:00:00Z');

/** A store holding one token, `token-123`, with the given grant. */
async function storeWith(grant: Partial<IndieAuthTokenRecord> = {}) {
  const { store } = memoryIndieAuthStore();
  await store.saveToken(hashSecret('token-123'), {
    clientId: 'https://client.example/',
    me: `${site.origin}/`,
    scope: ['create'],
    issuedAt: new Date('2026-09-01T00:00:00Z'),
    expiresAt: new Date('2026-12-01T00:00:00Z'),
    ...grant,
  });
  return store;
}

const options = { bearer: 'token-123', expectedMe: site.origin, now: NOW };

test('a token this site issued is accepted without calling out', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch');
  const store = await storeWith();

  assert.equal(await verifyIndieAuthToken({ ...options, store }), true);
  assert.equal(fetch.mock.callCount(), 0);
});

test('a token must carry the required scope', async () => {
  const store = await storeWith({ scope: ['create', 'update'] });
  assert.equal(
    await verifyIndieAuthToken({ ...options, store, requiredScope: 'update' }),
    true
  );
  assert.equal(
    await verifyIndieAuthToken({ ...options, store, requiredScope: 'delete' }),
    false
  );
  // A scope that only starts the same way is not the same scope.
  assert.equal(
    await verifyIndieAuthToken({ ...options, store, requiredScope: 'up' }),
    false
  );
  // Given a list, any one scope passes.
  assert.equal(
    await verifyIndieAuthToken({
      ...options,
      store,
      requiredScope: ['media', 'create'],
    }),
    true
  );
});

test('an unknown, expired, or foreign token is refused', async () => {
  const store = await storeWith();
  assert.equal(
    await verifyIndieAuthToken({ ...options, store, bearer: 'token-456' }),
    false
  );
  assert.equal(
    await verifyIndieAuthToken({
      ...options,
      store,
      now: new Date('2026-12-02T00:00:00Z'),
    }),
    false
  );

  const foreign = await storeWith({ me: 'https://example.com/' });
  assert.equal(
    await verifyIndieAuthToken({ ...options, store: foreign }),
    false
  );
});

test('a revoked token is refused', async () => {
  const store = await storeWith();
  await store.revokeToken(hashSecret('token-123'), NOW);
  assert.equal(await verifyIndieAuthToken({ ...options, store }), false);
});

test('getBearerToken reads the Authorization header', () => {
  const request = (authorization?: string) =>
    new Request(`${site.origin}/micropub`, {
      headers: authorization ? { Authorization: authorization } : {},
    });
  assert.equal(getBearerToken(request('Bearer abc ')), 'abc');
  assert.equal(getBearerToken(request('bearer abc')), 'abc');
  assert.equal(getBearerToken(request('Basic abc')), null);
  assert.equal(getBearerToken(request()), null);
});
