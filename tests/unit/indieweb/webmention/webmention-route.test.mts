import { POST } from '@/app/api/webmention/route';
import { NextRequest } from 'next/server';
import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { webmentionRateLimitStore } from '@/lib/indieweb/webmention/storage';

test('malformed webmentions do not wake Postgres for rate limiting', async () => {
  const hit = mock.method(webmentionRateLimitStore, 'hit', async () => 1);
  try {
    const unsupported = await POST(
      new NextRequest('https://willie.page/webmention', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: 'source=https://sender.example/&target=https://willie.page/',
      })
    );
    assert.equal(unsupported.status, 400);

    const wrongTarget = await POST(
      new NextRequest('https://willie.page/webmention', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          source: 'https://sender.example/post',
          target: 'https://another.example/post',
        }),
      })
    );
    assert.equal(wrongTarget.status, 400);
    assert.equal(hit.mock.callCount(), 0);
  } finally {
    hit.mock.restore();
  }
});

test('an acceptable Webmention target still passes through the shared limit', async () => {
  const hit = mock.method(webmentionRateLimitStore, 'hit', async () => 11);
  try {
    const response = await POST(
      new NextRequest('https://willie.page/webmention', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          source: 'https://sender.example/post',
          target: 'https://willie.page/',
        }),
      })
    );
    assert.equal(response.status, 429);
    assert.equal(hit.mock.callCount(), 1);
  } finally {
    hit.mock.restore();
  }
});

test('the Cloudflare guard rejects a burst before the Neon counter', async () => {
  const contextKey = Symbol.for('__cloudflare-context__');
  const previousContext = Reflect.get(globalThis, contextKey);
  const hit = mock.method(webmentionRateLimitStore, 'hit', async () => 1);
  const edgeKeys: string[] = [];
  Reflect.set(globalThis, contextKey, {
    env: {
      WEBMENTION_EDGE_LIMIT: {
        async limit({ key }: { key: string }) {
          edgeKeys.push(key);
          return { success: false };
        },
      },
    },
  });
  try {
    const response = await POST(
      new NextRequest('https://willie.page/webmention', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'cf-connecting-ip': '203.0.113.7',
        },
        body: new URLSearchParams({
          source: 'https://sender.example/post',
          target: 'https://willie.page/',
        }),
      })
    );
    assert.equal(response.status, 429);
    assert.deepEqual(edgeKeys, ['203.0.113.7']);
    assert.equal(hit.mock.callCount(), 0);
  } finally {
    hit.mock.restore();
    if (previousContext === undefined)
      Reflect.deleteProperty(globalThis, contextKey);
    else Reflect.set(globalThis, contextKey, previousContext);
  }
});
