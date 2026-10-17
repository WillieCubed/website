import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const publisher =
  await import('../../../scripts/indieweb/publish-notifications.mts');
const SHA = 'a'.repeat(40);
const NEXT = 'b'.repeat(40);
function fixture() {
  const state = {
    check: {
      id: 11,
      name: 'Workers Builds: willie-page',
      app: { id: 85455, slug: 'cloudflare-workers-and-pages' },
      head_sha: SHA,
      check_suite: { id: 12 },
      status: 'completed',
      conclusion: 'success',
    },
    branch: 'main',
    heads: [SHA, SHA],
    revision: { sha: SHA, runtime: 'cloudflare-workers' },
    revisionStatus: 200,
    revisionRaw: null as string | null,
    notifyStatus: 200,
    networkError: false,
    networkErrorPath: '',
  };
  const revisionResponse = () =>
    state.revisionRaw === null
      ? Response.json(state.revision, { status: state.revisionStatus })
      : new Response(state.revisionRaw, { status: state.revisionStatus });
  const calls: { url: URL; init: RequestInit }[] = [];
  const mainRevision = () =>
    state.heads.length > 1 ? state.heads.shift() : state.heads[0];
  const logs: string[] = [];
  const options = {
    eventName: 'check_run',
    event: { action: 'completed', check_run: { id: 11 } },
    repository: 'WillieCubed/website',
    ref: 'refs/heads/main',
    githubToken: 'github-read-token',
    productionSecret: 'notice-secret',
    log: (value: Record<string, unknown>) => logs.push(JSON.stringify(value)),
    fetch: async (url: string | URL | Request, init: RequestInit = {}) => {
      const parsed = new URL(String(url));
      calls.push({ url: parsed, init });
      assert.equal(init.redirect, 'error');
      if (state.networkError)
        throw new Error('notice-secret provider exception');
      if (parsed.pathname === state.networkErrorPath)
        throw new Error('notice-secret network error');
      if (parsed.pathname.endsWith('/check-runs/11'))
        return Response.json(state.check);
      if (parsed.pathname.endsWith('/check-suites/12'))
        return Response.json({ head_branch: state.branch, head_sha: SHA });
      if (parsed.pathname.endsWith('/branches/main'))
        return Response.json({
          commit: {
            sha: mainRevision(),
          },
        });
      if (parsed.pathname.endsWith('/check-runs'))
        return Response.json({ check_runs: [state.check] });
      if (parsed.pathname === '/api/indieweb/revision')
        return revisionResponse();
      if (parsed.pathname === '/api/indieweb/notify')
        return Response.json(
          {
            private: 'notice-secret',
            websub: { ok: true },
            webmentions: { failed: 0 },
            atproto: { status: 'synced' },
          },
          { status: state.notifyStatus }
        );
      throw new Error('Unexpected request: ' + parsed.pathname);
    },
  };
  const run = async () => {
    return publisher.publishAfterDeployment(options);
  };
  return {
    state,
    options,
    calls,
    logs,
    run,
    posts: () => calls.filter((v) => v.init.method === 'POST'),
  };
}

test('a trusted successful production check and exact live revision send one notification', async () => {
  const f = fixture();
  assert.deepEqual(await f.run(), { status: 'notified', sha: SHA });
  assert.equal(f.posts().length, 1);
  const post = f.posts()[0];
  assert.equal(post.url.href, 'https://willie.page/api/indieweb/notify');
  assert.deepEqual(JSON.parse(String(post.init.body)), {
    sha: SHA,
    atprotoRequired: true,
  });
  assert.equal(
    new Headers(post.init.headers).get('authorization'),
    'Bearer notice-secret'
  );
  assert.equal(f.logs.join().includes('notice-secret'), false);
});
test('a superseded build skips before contacting the site', async () => {
  const f = fixture();
  f.state.heads = [NEXT];
  assert.deepEqual(await f.run(), { status: 'superseded', sha: SHA });
  assert.equal(
    f.calls.some((v) => v.url.hostname === 'willie.page'),
    false
  );
  assert.equal(f.posts().length, 0);
});
test('a new push during revision verification skips before notification', async () => {
  const f = fixture();
  f.state.heads = [SHA, NEXT];
  assert.equal((await f.run()).status, 'superseded');
  assert.equal(f.posts().length, 0);
});
test('a wrong revision after build success is a real failure with safe observed diagnostics', async () => {
  const f = fixture();
  f.state.revision.sha = NEXT;
  await assert.rejects(f.run(), { code: 'revision_mismatch' });
  assert.equal(f.posts().length, 0);
  assert.ok(f.logs.some((v) => v.includes(NEXT) && v.includes('200')));
});
test('HTTP errors and invalid JSON are not treated as waiting for deployment', async () => {
  const failed = fixture();
  failed.state.revisionStatus = 503;
  await assert.rejects(failed.run(), { code: 'revision_http_error' });
  assert.equal(failed.posts().length, 0);
  const invalid = fixture();
  invalid.state.revisionRaw = '<html>notice-secret</html>';
  await assert.rejects(invalid.run(), { code: 'revision_json_error' });
  assert.equal(invalid.logs.join().includes('notice-secret'), false);
});
test('the SHA is insufficient when the origin is not serving the Worker runtime', async () => {
  const f = fixture();
  f.state.revision.runtime = 'other';
  await assert.rejects(f.run(), { code: 'revision_runtime_error' });
  assert.equal(f.posts().length, 0);
});
test('other apps, workers, and branches cannot initiate notifications', async () => {
  for (const change of ['app', 'worker', 'branch']) {
    const f = fixture();
    if (change === 'app') f.state.check.app.id = 15368;
    if (change === 'worker')
      f.state.check.name = 'Workers Builds: willie-page-preview';
    if (change === 'branch') f.state.branch = 'feature';
    assert.equal((await f.run()).status, 'ignored');
    assert.equal(f.posts().length, 0);
  }
});
test('failed and pending deployments remain distinguishable and never notify', async () => {
  const failed = fixture();
  failed.state.check.conclusion = 'failure';
  await assert.rejects(failed.run(), { code: 'deployment_failed' });
  const pending = fixture();
  pending.state.check.status = 'in_progress';
  await assert.rejects(pending.run(), { code: 'deployment_not_ready' });
  assert.equal(failed.posts().length + pending.posts().length, 0);
});
test('notification failures are not retried or logged with response bodies', async () => {
  const f = fixture();
  f.state.notifyStatus = 502;
  await assert.rejects(f.run(), { code: 'notification_failed' });
  assert.equal(f.posts().length, 1);
  assert.equal(f.logs.join().includes('notice-secret'), false);
});
test('a deployment race returning 409 skips only when a newer main revision exists', async () => {
  const newer = fixture();
  newer.state.notifyStatus = 409;
  newer.state.heads = [SHA, SHA, NEXT];
  assert.equal((await newer.run()).status, 'superseded');
  assert.equal(newer.posts().length, 1);
  const conflict = fixture();
  conflict.state.notifyStatus = 409;
  await assert.rejects(conflict.run(), { code: 'notification_conflict' });
  assert.equal(conflict.posts().length, 1);
});
test('manual recovery requires a successful matching Cloudflare check for main', async () => {
  const f = fixture();
  f.options.eventName = 'workflow_dispatch';
  assert.equal((await f.run()).status, 'notified');
  const failed = fixture();
  failed.options.eventName = 'workflow_dispatch';
  failed.state.check.conclusion = 'failure';
  await assert.rejects(failed.run(), { code: 'deployment_failed' });
  assert.equal(failed.posts().length, 0);
});
test('network errors fail safely without exposing credentials', async () => {
  const f = fixture();
  f.state.networkError = true;
  await assert.rejects(f.run(), { code: 'github_network_error' });
  assert.equal(f.logs.join().includes('notice-secret'), false);
  assert.equal(f.posts().length, 0);
});
test('a network error after starting notification never retries the POST', async () => {
  const f = fixture();
  f.state.networkErrorPath = '/api/indieweb/notify';
  await assert.rejects(f.run(), { code: 'notification_network_error' });
  assert.equal(f.posts().length, 1);
  assert.equal(f.logs.join().includes('notice-secret'), false);
});
test('missing credentials fail without attempting publication', async () => {
  const github = fixture();
  github.options.githubToken = '';
  await assert.rejects(github.run(), { code: 'github_token_missing' });
  assert.equal(github.calls.length, 0);
  const secret = fixture();
  secret.options.productionSecret = '';
  await assert.rejects(secret.run(), { code: 'notification_secret_missing' });
  assert.equal(secret.posts().length, 0);
});
test('untrusted event contexts and non-main manual runs are ignored', async () => {
  for (const kind of ['repository', 'event', 'branch', 'action']) {
    const f = fixture();
    if (kind === 'repository') f.options.repository = 'Other/website';
    if (kind === 'event') f.options.eventName = 'push';
    if (kind === 'branch') {
      f.options.eventName = 'workflow_dispatch';
      f.options.ref = 'refs/heads/feature';
    }
    if (kind === 'action') f.options.event.action = 'created';
    assert.deepEqual(await f.run(), { status: 'ignored' });
    assert.equal(f.calls.length, 0);
  }
});
test('a main suite with a different SHA cannot authorize publication', async () => {
  const f = fixture();
  f.state.check.head_sha = NEXT;
  await assert.rejects(f.run(), { code: 'deployment_revision_invalid' });
  assert.equal(f.posts().length, 0);
});
test('the workflow follows Cloudflare completion rather than every main push', async () => {
  const workflow = await readFile(
    new URL('../../../.github/workflows/indieweb-publish.yml', import.meta.url),
    'utf8'
  );
  assert.match(workflow, /check_run:\s*\n\s*types: \[completed\]/);
  assert.doesNotMatch(workflow, /^\s+push:/m);
  assert.match(workflow, /Workers Builds: willie-page/);
  assert.match(workflow, /85455/);
  assert.match(workflow, /checks: read/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /group: indieweb-publish-production/);
  assert.match(workflow, /queue: max/);
  assert.doesNotMatch(workflow, /seq 1 60|sleep 10|\|\| true/);
});
