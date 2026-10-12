import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createTotpOwnerAuthenticator,
  decodeBase32,
  totpCode,
  totpStep,
} from '../../lib/indieweb/indieauth-owner';
import { createAdminHandler, tokenHash } from '../../lib/status/admin';
import {
  citySchema,
  defaultLocation,
  publicLocation,
  resolveLocation,
  searchCities,
} from '../../lib/status/location';
import type { StatusStore } from '../../lib/status/store';
import { memoryOwnerSignInStore } from './indieauth-memory-store.mts';

function setup() {
  let snapshot: Awaited<ReturnType<StatusStore['read']>> = null;
  const sessions = new Map<string, Date>();
  let invalidations = 0;
  const store: StatusStore = {
    async read() {
      return snapshot;
    },
    async save(location) {
      snapshot = {
        location,
        source: 'manual',
        updatedAt: new Date().toISOString(),
      };
    },
    async createSession(hash, expires) {
      sessions.set(hash, expires);
    },
    async hasSession(hash) {
      return (sessions.get(hash)?.getTime() ?? 0) > Date.now();
    },
    async deleteSession(hash) {
      sessions.delete(hash);
    },
  };
  const secret = decodeBase32('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')!;
  const now = new Date();
  const owner = createTotpOwnerAuthenticator({
    secret,
    store: memoryOwnerSignInStore().store,
    now: () => now,
  });
  const handle = createAdminHandler({
    store,
    owner,
    invalidate: () => invalidations++,
    search: async () => [defaultLocation.location],
  });
  const request = (
    fields?: Record<string, string>,
    cookie?: string,
    origin = 'https://willie.page'
  ) =>
    new Request(
      'https://willie.page/admin/status',
      fields
        ? {
            method: 'POST',
            headers: {
              Origin: origin,
              'Content-Type': 'application/x-www-form-urlencoded',
              ...(cookie ? { Cookie: cookie } : {}),
            },
            body: new URLSearchParams(fields),
          }
        : { headers: cookie ? { Cookie: cookie } : {} }
    );
  const signin = () =>
    handle(
      request({ action: 'signin', code: totpCode(secret, totpStep(now)) })
    );
  return {
    store,
    sessions,
    handle,
    request,
    signin,
    invalidations: () => invalidations,
  };
}

test('only city-level fields cross the public boundary and corrupt sources fail closed', async () => {
  assert.deepEqual(
    await resolveLocation({ read: async () => null }),
    defaultLocation
  );
  assert.deepEqual(Object.keys(publicLocation(defaultLocation)), [
    'city',
    'region',
    'country',
    'timezone',
    'updatedAt',
  ]);
  await assert.rejects(
    resolveLocation({
      read: async () => {
        throw new Error('database offline');
      },
    })
  );
  assert.equal(
    citySchema.safeParse({
      ...defaultLocation.location,
      timezone: 'Mars/Olympus',
    }).success,
    false
  );
  assert.equal(
    citySchema.safeParse({ ...defaultLocation.location, latitude: 91 }).success,
    false
  );
});

test('owner TOTP creates an opaque expiring session and replay cannot create another', async () => {
  const app = setup();
  const signInPage = await app.handle(app.request());
  assert.equal(signInPage.headers.get('referrer-policy'), 'same-origin');
  assert.match(
    await signInPage.text(),
    /name="referrer" content="same-origin"/
  );
  const response = await app.signin();
  assert.equal(response.status, 303);
  const cookie = response.headers.get('set-cookie')!;
  assert.match(cookie, /HttpOnly; SameSite=Strict; Max-Age=28800; Secure/);
  const token = cookie.split(';')[0].split('=')[1];
  assert.equal(app.sessions.has(token), false);
  assert.equal(app.sessions.has(tokenHash(token)), true);
  assert.equal((await app.signin()).status, 401);
  app.sessions.set(tokenHash(token), new Date(0));
  assert.match(
    await (await app.handle(app.request(undefined, cookie))).text(),
    /Authenticator code/
  );
});

test('unauthenticated, cross-origin, malformed and CSRF writes cannot update location', async () => {
  const app = setup();
  assert.equal((await app.handle(app.request({ action: 'save' }))).status, 401);
  assert.equal(
    (
      await app.handle(
        app.request({ action: 'signin' }, undefined, 'https://evil.test')
      )
    ).status,
    403
  );
  const response = await app.signin();
  const cookie = response.headers.get('set-cookie')!.split(';')[0];
  assert.equal(
    (
      await app.handle(
        app.request(
          { action: 'save', city: JSON.stringify(defaultLocation.location) },
          cookie
        )
      )
    ).status,
    403
  );
  const html = await (await app.handle(app.request(undefined, cookie))).text();
  const csrf = html.match(/name="csrf" value="([a-f0-9]+)"/)![1];
  assert.equal(
    (
      await app.handle(
        app.request({ action: 'save', csrf, city: '{oops' }, cookie)
      )
    ).status,
    400
  );
  assert.equal(await app.store.read(), null);
  assert.equal(app.invalidations(), 0);
});

test('saving a city persists the manual source, invalidates public cache and logout revokes access', async () => {
  const app = setup();
  const cookie = (await app.signin()).headers.get('set-cookie')!.split(';')[0];
  const html = await (await app.handle(app.request(undefined, cookie))).text();
  const csrf = html.match(/name="csrf" value="([a-f0-9]+)"/)![1];
  const city = {
    ...defaultLocation.location,
    city: 'Seattle',
    timezone: 'America/Los_Angeles',
    latitude: 47.61,
    longitude: -122.33,
  };
  assert.equal(
    (
      await app.handle(
        app.request(
          { action: 'save', csrf, city: JSON.stringify(city) },
          cookie
        )
      )
    ).status,
    303
  );
  assert.equal((await app.store.read())?.location.city, 'Seattle');
  assert.equal((await app.store.read())?.source, 'manual');
  assert.equal(app.invalidations(), 1);
  assert.equal(
    (await app.handle(app.request({ action: 'signout', csrf }, cookie))).status,
    303
  );
  assert.equal(
    (
      await app.handle(
        app.request(
          { action: 'save', csrf, city: JSON.stringify(city) },
          cookie
        )
      )
    ).status,
    401
  );
});

test('missing owner configuration disables admin and provider search filters incomplete cities', async () => {
  const app = setup();
  const disabled = createAdminHandler({
    store: app.store,
    owner: null,
    invalidate() {},
  });
  assert.equal((await disabled(app.request())).status, 503);
  let calls = 0;
  const fetcher = (async () => {
    calls++;
    return Response.json({
      results: [
        {
          name: 'London',
          country: 'United Kingdom',
          timezone: 'Europe/London',
          latitude: 51.5,
          longitude: -0.1,
        },
        { name: 'Missing timezone' },
      ],
    });
  }) as typeof fetch;
  assert.equal((await searchCities('London', fetcher)).length, 1);
  assert.equal((await searchCities('x', fetcher)).length, 0);
  assert.equal(calls, 1);
});

test('a failed save preserves the previous city and lets the owner retry', async () => {
  const app = setup();
  await app.store.save(defaultLocation.location);
  const cookie = (await app.signin()).headers.get('set-cookie')!.split(';')[0];
  const handle = createAdminHandler({
    store: {
      ...app.store,
      async save() {
        throw new Error('write unavailable');
      },
    },
    owner: {
      prompt: 'code',
      async verify() {
        return { ok: true };
      },
    },
    invalidate() {
      assert.fail('A failed write must not invalidate the location cache');
    },
  });
  const html = await (await handle(app.request(undefined, cookie))).text();
  const csrf = html.match(/name="csrf" value="([a-f0-9]+)"/)![1];
  const city = {
    ...defaultLocation.location,
    city: 'Seattle',
    region: 'Washington',
    latitude: 47.61,
    longitude: -122.33,
  };
  const response = await handle(
    app.request({ action: 'save', csrf, city: JSON.stringify(city) }, cookie)
  );
  assert.equal(response.status, 503);
  const failure = await response.text();
  assert.match(failure, /Could not save. Try again./);
  assert.match(failure, /data-location-editor/);
  assert.match(failure, /data-city-display hidden>Las Vegas/);
  assert.equal((await app.store.read())?.location.city, 'Las Vegas');
});
