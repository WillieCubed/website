import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdminHandler } from '../../lib/status/admin';
import { defaultLocation } from '../../lib/status/location';
import type { StatusStore } from '../../lib/status/store';

test('status editor trusts Access on each request and only saves same-origin owner writes', async () => {
  let saved: string | null = null;
  let invalidations = 0;
  const store: StatusStore = {
    read: async () => null,
    save: async (location) => {
      saved = location.city;
    },
  };
  const handle = createAdminHandler({
    store,
    owner: {
      prompt: 'none',
      verify: async (request) =>
        request.headers.get('cf-access-jwt-assertion') === 'verified'
          ? { ok: true }
          : { ok: false, reason: 'invalid' },
    },
    invalidate: () => {
      invalidations++;
    },
  });
  const url = 'https://willie.page/api/admin/status';
  const access = { 'Cf-Access-Jwt-Assertion': 'verified' };
  assert.equal((await handle(new Request(url))).status, 401);
  const signedIn = await handle(new Request(url, { headers: access }));
  assert.equal((await signedIn.json()).signedIn, true);

  const form = new URLSearchParams({
    action: 'save',
    city: JSON.stringify(defaultLocation.location),
  });
  const request = (headers: Record<string, string>) =>
    new Request(url, { method: 'POST', headers, body: form });
  assert.equal(
    (await handle(request({ Origin: 'https://willie.page' }))).status,
    401
  );
  assert.equal(
    (await handle(request({ ...access, Origin: 'https://evil.test' }))).status,
    403
  );
  assert.equal(
    (await handle(request({ ...access, Origin: 'https://willie.page' })))
      .status,
    303
  );
  assert.equal(saved, 'Las Vegas');
  assert.equal(invalidations, 1);
});
