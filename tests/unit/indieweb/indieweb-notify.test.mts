import { POST } from '@/app/api/indieweb/notify/route';
import assert from 'node:assert/strict';
import test from 'node:test';

test('publish notification requires its secret and matching deployed revision', async () => {
  const oldSecret = process.env.INDIEWEB_NOTIFY_SECRET;
  const oldSha = process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    delete process.env.INDIEWEB_NOTIFY_SECRET;
    assert.equal(
      (
        await POST(
          new Request('https://willie.page/api/indieweb/notify', {
            method: 'POST',
          })
        )
      ).status,
      503
    );
    process.env.INDIEWEB_NOTIFY_SECRET = 'test-secret';
    process.env.VERCEL_GIT_COMMIT_SHA = 'deployed-sha';
    const post = (authorization: string, sha: string) =>
      POST(
        new Request('https://willie.page/api/indieweb/notify', {
          method: 'POST',
          headers: { authorization, 'content-type': 'application/json' },
          body: JSON.stringify({ sha }),
        })
      );
    assert.equal((await post('Bearer wrong', 'deployed-sha')).status, 401);
    assert.equal((await post('Bearer test-secret', 'old-sha')).status, 409);
  } finally {
    if (oldSecret === undefined) delete process.env.INDIEWEB_NOTIFY_SECRET;
    else process.env.INDIEWEB_NOTIFY_SECRET = oldSecret;
    if (oldSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = oldSha;
  }
});
