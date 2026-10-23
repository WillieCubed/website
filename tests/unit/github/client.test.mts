import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GitHubError,
  github,
  githubOptional,
  rebaseMergePullRequest,
} from '@/lib/github/client';
import { HttpError } from '@/lib/http/errors';
import { StudioError } from '@/lib/studio/errors';

test('shared HTTP errors preserve legacy Studio identity and response details', () => {
  const error = new HttpError(409, 'Changed', { revision: 'saved' });
  assert.ok(error instanceof StudioError);
  assert.equal(error.status, 409);
  assert.equal(error.message, 'Changed');
  assert.deepEqual(error.details, { revision: 'saved' });
});

test('GitHub transport preserves authentication, request encoding, and upstream failure statuses', async (context) => {
  const names = ['STUDIO_GITHUB_REPOSITORY', 'STUDIO_GITHUB_TOKEN'];
  const saved = names.map((name) => process.env[name]);
  context.after(() => {
    names.forEach((name, index) => {
      if (saved[index] === undefined) delete process.env[name];
      else process.env[name] = saved[index];
    });
  });
  process.env.STUDIO_GITHUB_REPOSITORY = 'owner/site';
  process.env.STUDIO_GITHUB_TOKEN = 'fixture-token';
  const calls: { url: string; init: RequestInit }[] = [];
  let status = 200;
  context.mock.method(
    globalThis,
    'fetch',
    async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Response.json({ sha: 'commit' }, { status });
    }
  );
  await github('git/refs', 'POST', { ref: 'refs/heads/review' });
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/owner/site/git/refs'
  );
  assert.equal(
    new Headers(calls[0].init.headers).get('authorization'),
    'Bearer fixture-token'
  );
  assert.equal(
    calls[0].init.body,
    JSON.stringify({ ref: 'refs/heads/review' })
  );
  assert.equal(calls[0].init.cache, 'no-store');
  await github('$graphql', 'POST', { query: 'fixture' }, false);
  assert.equal(calls[1].url, 'https://api.github.com/graphql');
  assert.equal(new Headers(calls[1].init.headers).get('authorization'), null);
  for (const [upstream, expected] of [
    [409, 409],
    [422, 409],
    [403, 502],
  ]) {
    status = upstream;
    await assert.rejects(
      github('git/refs'),
      (error: unknown) =>
        error instanceof GitHubError &&
        error instanceof HttpError &&
        error.githubStatus === upstream &&
        error.status === expected
    );
  }
  status = 404;
  assert.equal(await githubOptional('git/ref/heads/absent'), null);
  status = 405;
  assert.equal(await rebaseMergePullRequest(1, 'reviewed-sha'), null);
});
