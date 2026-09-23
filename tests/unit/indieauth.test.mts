import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';

import { INDIEAUTH_TOKEN_ENDPOINT } from '@/lib/indieweb/constants';
import { verifyIndieAuthToken } from '@/lib/indieweb/indieauth';
import { site } from '@/lib/site';

const options = {
  bearer: 'token-123',
  endpoint: INDIEAUTH_TOKEN_ENDPOINT,
  expectedMe: site.origin,
};

/** Answer the token endpoint with `body` and `status`. */
function tokenEndpoint(body: unknown, status = 200) {
  return mock.method(globalThis, 'fetch', async () =>
    typeof body === 'string'
      ? new Response(body, { status })
      : Response.json(body, { status })
  );
}

afterEach(() => mock.restoreAll());

test('a token issued for this site is accepted', async () => {
  const fetch = tokenEndpoint({ me: `${site.origin}/`, scope: 'create' });
  assert.equal(await verifyIndieAuthToken(options), true);

  const [url, init] = fetch.mock.calls[0].arguments as [string, RequestInit];
  assert.equal(url, INDIEAUTH_TOKEN_ENDPOINT);
  assert.equal(
    new Headers(init.headers).get('Authorization'),
    'Bearer token-123'
  );
});

test('a token must carry the required scope', async () => {
  tokenEndpoint({ me: site.origin, scope: 'create update' });
  assert.equal(
    await verifyIndieAuthToken({ ...options, requiredScope: 'update' }),
    true
  );
  assert.equal(
    await verifyIndieAuthToken({ ...options, requiredScope: 'delete' }),
    false
  );
  // A scope that only starts the same way is not the same scope.
  assert.equal(
    await verifyIndieAuthToken({ ...options, requiredScope: 'up' }),
    false
  );
});

test('a token with no scope fails a scope check', async () => {
  tokenEndpoint({ me: site.origin });
  assert.equal(
    await verifyIndieAuthToken({ ...options, requiredScope: 'create' }),
    false
  );
});

test('a token issued for another site is refused', async () => {
  tokenEndpoint({ me: 'https://example.com/', scope: 'create' });
  assert.equal(await verifyIndieAuthToken(options), false);
});

test('a token the endpoint rejects is refused', async () => {
  tokenEndpoint({ error: 'invalid_token' }, 401);
  assert.equal(await verifyIndieAuthToken(options), false);
});

test('an endpoint response that is not JSON is refused', async () => {
  tokenEndpoint('me=https://willie.page/');
  assert.equal(await verifyIndieAuthToken(options), false);
});
