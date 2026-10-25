import assert from 'node:assert/strict';
import test from 'node:test';

import { requestStatus } from '@/lib/status/browser-request';

const snapshot = {
  location: { city: 'Las Vegas', timezone: 'America/Los_Angeles' },
  weather: null,
};

test('simultaneous status readers receive one response and one reader cannot cancel another', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  globalThis.fetch = async (_url, options) => {
    requests += 1;
    await ready;
    assert.equal(options?.signal?.aborted, false);
    return Response.json(snapshot);
  };
  try {
    const first = new AbortController();
    const second = new AbortController();
    const one = requestStatus(first.signal);
    const two = requestStatus(second.signal);
    first.abort();
    release();
    assert.deepEqual(await two, snapshot);
    await one;
    assert.equal(requests, 1);
    assert.deepEqual(
      await requestStatus(new AbortController().signal),
      snapshot
    );
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test('a failed status request can retry without retaining its rejected promise', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return requests === 1
      ? new Response(null, { status: 503 })
      : Response.json(snapshot);
  };
  try {
    assert.equal(await requestStatus(new AbortController().signal), null);
    assert.deepEqual(
      await requestStatus(new AbortController().signal),
      snapshot
    );
  } finally {
    globalThis.fetch = original;
  }
});
