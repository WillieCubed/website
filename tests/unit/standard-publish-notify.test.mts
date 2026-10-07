import assert from 'node:assert/strict';
import test from 'node:test';

import { publishNotification } from '@/lib/indieweb/notify';

test('production notifications fail when required publishing was skipped', async (context) => {
  const previous = {
    secret: process.env.INDIEWEB_NOTIFY_SECRET,
    revision: process.env.VERCEL_GIT_COMMIT_SHA,
  };
  context.after(() => {
    if (previous.secret === undefined)
      delete process.env.INDIEWEB_NOTIFY_SECRET;
    else process.env.INDIEWEB_NOTIFY_SECRET = previous.secret;
    if (previous.revision === undefined)
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previous.revision;
  });
  process.env.INDIEWEB_NOTIFY_SECRET = 'notify-test';
  process.env.VERCEL_GIT_COMMIT_SHA = 'revision';
  for (const required of [true, false]) {
    const response = await publishNotification(
      new Request('https://willie.page/api/indieweb/notify', {
        method: 'POST',
        headers: {
          authorization: 'Bearer notify-test',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ sha: 'revision', atprotoRequired: required }),
      }),
      {
        topics: async () => [],
        hub: async () => ({ ok: true }),
        mentions: async () => ({ failed: 0 }),
        sync: async () => ({ status: 'skipped', reason: 'missing credential' }),
      }
    );
    assert.equal(response.status, required ? 502 : 200);
    assert.equal((await response.json()).atproto.status, 'skipped');
  }
});
