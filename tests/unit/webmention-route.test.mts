import { POST } from '@/app/api/webmention/route';
import { NextRequest } from 'next/server';
import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import { webmentionRateLimitStore } from '@/lib/indieweb/webmention-storage';

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
