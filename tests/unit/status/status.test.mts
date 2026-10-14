import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdminHandler } from '../../../lib/status/admin';
import {
  citySchema,
  defaultLocation,
  publicLocation,
  resolveLocation,
  searchCities,
} from '../../../lib/status/location';
import type { StatusStore } from '../../../lib/status/store';

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

test('provider search filters incomplete cities', async () => {
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

test('failed save preserves the previous city for the owner to retry', async () => {
  const store: StatusStore = {
    read: async () => ({
      ...defaultLocation,
      source: 'manual',
    }),
    save: async () => {
      throw new Error('write unavailable');
    },
  };
  const handle = createAdminHandler({
    store,
    owner: { verify: async () => ({ ok: true }) },
    invalidate: () =>
      assert.fail('Failed writes must not invalidate the public cache'),
  });
  const city = {
    ...defaultLocation.location,
    city: 'Seattle',
    region: 'Washington',
    latitude: 47.61,
    longitude: -122.33,
  };
  const response = await handle(
    new Request('https://willie.page/api/admin/status', {
      method: 'POST',
      headers: {
        Origin: 'https://willie.page',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ action: 'save', city: JSON.stringify(city) }),
    })
  );
  assert.equal(response.status, 503);
  const failure = await response.json();
  assert.equal(failure.message, 'Could not save. Try again.');
  assert.equal(failure.signedIn, true);
  assert.equal(failure.snapshot.location.city, 'Las Vegas');
  assert.equal(failure.results[0].city, 'Seattle');
});
