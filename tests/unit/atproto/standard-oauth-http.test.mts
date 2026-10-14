import assert from 'node:assert/strict';
import test from 'node:test';

import { validateBrowserBinding } from '@/lib/atproto/oauth-binding';
import {
  type SocialServices,
  createSocialHandlers,
} from '@/lib/atproto/social-http';

const origin = 'https://site.example';
function services(overrides: Partial<SocialServices> = {}): SocialServices {
  return {
    enabled: true,
    origin,
    session: async () => ({
      did: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa',
      id: 'browser',
    }),
    issueSession: async () => 'opaque-session',
    logout: async () => {},
    rate: async () => true,
    authorize: async () => new URL('https://provider.example/authorize'),
    callback: async () => ({
      did: 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa',
      intent: { action: 'subscription', returnTo: '/writings' },
    }),
    target: async () =>
      'at://did:plc:aaaaaaaaaaaaaaaaaaaaaaaa/site.standard.publication/3khuwc44c222b',
    repo: async () => ({
      list: async () => [],
      create: async () => {},
      remove: async () => {},
    }),
    lock: async (_, fn) => fn(),
    ...overrides,
  };
}
function request(
  path: string,
  body: unknown,
  method = 'PUT',
  extra: Record<string, string> = {}
) {
  return new Request(origin + path, {
    method,
    headers: { origin, 'content-type': 'application/json', ...extra },
    body: JSON.stringify(body),
  });
}

test('social writes reject cross-origin, unsigned and invalid target requests', async () => {
  const handlers = createSocialHandlers(services());
  assert.equal(
    (
      await handlers.subscription(
        request('/api/atproto/subscription', {}, 'PUT', {
          origin: 'https://evil.example',
        })
      )
    ).status,
    403
  );
  assert.equal(
    (
      await createSocialHandlers(
        services({ session: async () => null })
      ).subscription(request('/api/atproto/subscription', {}))
    ).status,
    401
  );
  assert.equal(
    (
      await handlers.recommendation(
        request('/api/atproto/recommendation', { slug: '../draft' })
      )
    ).status,
    400
  );
  const unavailable = createSocialHandlers(
    services({
      target: async () => {
        throw new Error('unverified');
      },
    })
  );
  assert.equal(
    (await unavailable.subscription(request('/api/atproto/subscription', {})))
      .status,
    502
  );
});

test('rate limits prevent writes and PDS failures leave the action unsuccessful', async () => {
  assert.equal(
    (
      await createSocialHandlers(
        services({ rate: async () => false })
      ).subscription(request('/api/atproto/subscription', {}))
    ).status,
    429
  );
  const handlers = createSocialHandlers(
    services({
      repo: async () => ({
        list: async () => [],
        create: async () => {
          throw new Error('offline');
        },
        remove: async () => {},
      }),
    })
  );
  assert.equal(
    (await handlers.subscription(request('/api/atproto/subscription', {})))
      .status,
    502
  );
});

test('login binds the flow to a secure cookie and restricts return paths', async () => {
  let state: unknown;
  const handlers = createSocialHandlers(
    services({
      authorize: async (_, intent) => {
        state = intent;
        return new URL('https://provider.example/authorize');
      },
    })
  );
  const result = await handlers.login(
    request(
      '/api/atproto/login',
      {
        handle: 'reader.example',
        action: 'subscription',
        returnTo: 'https://evil.example',
      },
      'POST'
    )
  );
  assert.equal(result.status, 200);
  assert.equal((await result.json()).url, 'https://provider.example/authorize');
  assert.match(
    result.headers.get('set-cookie')!,
    /HttpOnly; Secure; SameSite=Lax/
  );
  assert.equal((state as { returnTo: string }).returnTo, '/writings');
  assert.ok((state as { browserHash: string }).browserHash);
});

test('callbacks reject a flow from another browser and consumed or expired state', () => {
  assert.throws(() => validateBrowserBinding(undefined, 'cookie'));
  assert.throws(() =>
    validateBrowserBinding({ browserHash: 'wrong' }, 'cookie')
  );
});

test('callback creates a browser session and completes the original action', async () => {
  let writes = 0;
  const handlers = createSocialHandlers(
    services({
      repo: async () => ({
        list: async () => [],
        create: async () => {
          writes++;
        },
        remove: async () => {},
      }),
    })
  );
  const response = await handlers.callback(
    new Request(origin + '/atproto/callback?code=code&state=state', {
      headers: { cookie: 'atproto_flow=binding' },
    })
  );
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), origin + '/writings');
  assert.match(
    response.headers.get('set-cookie')!,
    /atproto_session=opaque-session/
  );
  assert.equal(writes, 1);
});

test('logout ends the browser session and unauthenticated reads do not access another account', async () => {
  let signedOut = false;
  const h = createSocialHandlers(
    services({
      logout: async () => {
        signedOut = true;
      },
      session: async () => null,
      repo: async () => {
        throw new Error('must not read a repo');
      },
    })
  );
  assert.equal(
    (await h.logout(request('/api/atproto/logout', {}, 'POST'))).status,
    200
  );
  assert.ok(signedOut);
  const response = await h.status(new Request(origin + '/api/atproto/social'));
  assert.equal((await response.json()).signedIn, false);
});
