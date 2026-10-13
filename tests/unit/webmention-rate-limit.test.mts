import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import type { WebmentionRateLimitStore } from '@/lib/indieweb/types';
import {
  WEBMENTION_RATE_LIMIT,
  WEBMENTION_RATE_WINDOW_MS,
  isWithinEdgeWebmentionRateLimit,
  isWithinWebmentionRateLimit,
  webmentionRateLimitKey,
} from '@/lib/indieweb/webmention-rate-limit';

/**
 * An in-memory store that counts hits per key in one window, standing in for
 * the Postgres table shared by every instance.
 */
function memoryStore() {
  const hits = new Map<string, number>();
  const windows: number[] = [];
  const store: WebmentionRateLimitStore = {
    async hit(key, windowMs) {
      windows.push(windowMs);
      const count = (hits.get(key) ?? 0) + 1;
      hits.set(key, count);
      return count;
    },
    async prune() {
      hits.clear();
    },
  };
  return { store, windows };
}

test('the rate limit key prefers Cloudflare client IP over forwarded addresses', () => {
  assert.equal(
    webmentionRateLimitKey(
      new Headers({
        'cf-connecting-ip': '203.0.113.7',
        'x-forwarded-for': '198.51.100.2, 203.0.113.7',
      })
    ),
    '203.0.113.7'
  );
  assert.equal(
    webmentionRateLimitKey(
      new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })
    ),
    '203.0.113.7'
  );
  assert.equal(
    webmentionRateLimitKey(new Headers({ 'x-real-ip': '198.51.100.2' })),
    '198.51.100.2'
  );
  assert.equal(webmentionRateLimitKey(new Headers()), 'unknown');
});

test('the edge guard rejects excess requests before the database counter', async () => {
  const keys: string[] = [];
  const limiter = {
    async limit({ key }: { key: string }) {
      keys.push(key);
      return { success: keys.length <= WEBMENTION_RATE_LIMIT };
    },
  };
  for (let i = 0; i < WEBMENTION_RATE_LIMIT; i++) {
    assert.equal(
      await isWithinEdgeWebmentionRateLimit(limiter, '203.0.113.7'),
      true
    );
  }
  assert.equal(
    await isWithinEdgeWebmentionRateLimit(limiter, '203.0.113.7'),
    false
  );
  assert.equal(keys.length, WEBMENTION_RATE_LIMIT + 1);
});

test('a missing or failed edge binding falls back to the database counter', async () => {
  assert.equal(await isWithinEdgeWebmentionRateLimit(undefined, 'ip'), true);
  const error = mock.method(console, 'error', () => {});
  try {
    assert.equal(
      await isWithinEdgeWebmentionRateLimit(
        {
          async limit() {
            throw new Error('Rate limiter unavailable');
          },
        },
        'ip'
      ),
      true
    );
    assert.equal(error.mock.callCount(), 1);
  } finally {
    error.mock.restore();
  }
});

test('requests past the limit in one window are refused', async () => {
  const { store, windows } = memoryStore();
  for (let i = 0; i < WEBMENTION_RATE_LIMIT; i++) {
    assert.equal(await isWithinWebmentionRateLimit(store, '203.0.113.7'), true);
  }
  assert.equal(await isWithinWebmentionRateLimit(store, '203.0.113.7'), false);
  assert.ok(
    windows.every((windowMs) => windowMs === WEBMENTION_RATE_WINDOW_MS)
  );
});

test('the limit counts each key separately', async () => {
  const { store } = memoryStore();
  for (let i = 0; i <= WEBMENTION_RATE_LIMIT; i++) {
    await isWithinWebmentionRateLimit(store, '203.0.113.7');
  }
  assert.equal(await isWithinWebmentionRateLimit(store, '203.0.113.7'), false);
  assert.equal(await isWithinWebmentionRateLimit(store, '198.51.100.2'), true);
});

test('a store that fails lets the request through', async () => {
  const store: WebmentionRateLimitStore = {
    async hit() {
      throw new Error('relation "webmention_rate_limits" does not exist');
    },
    async prune() {},
  };
  const error = mock.method(console, 'error', () => {});
  try {
    assert.equal(await isWithinWebmentionRateLimit(store, '203.0.113.7'), true);
    assert.equal(error.mock.callCount(), 1);
  } finally {
    error.mock.restore();
  }
});
