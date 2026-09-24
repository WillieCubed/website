import assert from 'node:assert/strict';
import test from 'node:test';

import { pingWebSubHub } from '@/lib/indieweb/websub-publisher';

test('WebSub notifies the hub once for each public feed', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; feeds: string[]; mode: string | null }> =
    [];
  globalThis.fetch = async (input, init) => {
    const body = new URLSearchParams(String(init?.body));
    calls.push({
      url: String(input),
      feeds: body.getAll('hub.url'),
      mode: body.get('hub.mode'),
    });
    return new Response(null, { status: 204 });
  };
  try {
    const result = await pingWebSubHub(
      ['https://example.org/feed.xml', 'https://example.org/feed/atom'],
      'https://hub.example/subscribe'
    );
    assert.deepEqual(result, { ok: true, status: 204 });
    assert.deepEqual(calls, [
      {
        url: 'https://hub.example/subscribe',
        feeds: ['https://example.org/feed.xml'],
        mode: 'publish',
      },
      {
        url: 'https://hub.example/subscribe',
        feeds: ['https://example.org/feed/atom'],
        mode: 'publish',
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WebSub reports a rejected feed', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(null, { status: calls === 2 ? 503 : 204 });
  };
  try {
    assert.deepEqual(
      await pingWebSubHub(
        ['https://example.org/feed.xml', 'https://example.org/feed/atom'],
        'https://hub.example/subscribe'
      ),
      { ok: false, status: 503 }
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('WebSub treats an unregistered topic without subscribers as idle', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1
      ? new Response('Topic not found for topic URL.', { status: 500 })
      : new Response(null, { status: 202 });
  };
  try {
    assert.deepEqual(
      await pingWebSubHub(
        ['https://example.org/feed.xml', 'https://example.org/feed/atom'],
        'https://websubhub.com/hub'
      ),
      { ok: true, status: 202 }
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
