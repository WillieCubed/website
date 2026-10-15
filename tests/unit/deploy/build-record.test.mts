import { GET as revision } from '@/app/api/indieweb/revision/route';
import { GET as humans } from '@/app/humans.txt/route';
import assert from 'node:assert/strict';
import test from 'node:test';

import { createBuildRecord } from '../../../scripts/shared/build-record.mts';

const sha = '0123456789abcdef0123456789abcdef01234567';
const now = new Date('2026-10-14T16:30:00.000Z');

test('a Workers build links to its own run and preserves the supplied build time', () => {
  const record = createBuildRecord(
    {
      NODE_ENV: 'production',
      WORKERS_CI: '1',
      WORKERS_CI_BUILD_UUID: '552b8624-d26c-47ff-a6f1-a967152e872a',
      WORKERS_CI_COMMIT_SHA: sha,
      SITE_BUILT_AT: '2026-10-14T15:00:00.000Z',
    },
    null,
    now
  );
  assert.equal(record.revision, sha);
  assert.equal(record.builtAt, '2026-10-14T15:00:00.000Z');
  assert.equal(
    record.buildUrl,
    'https://dash.cloudflare.com/18f90fa11cf0a87145be4a1517e41217/workers/services/view/willie-page/production/builds/552b8624-d26c-47ff-a6f1-a967152e872a'
  );
  assert.equal(record.provider, 'cloudflare');
});

test('preview build records link to the preview Worker', () => {
  const record = createBuildRecord(
    {
      NODE_ENV: 'production',
      SITE_MODE: 'preview',
      WORKERS_CI: '1',
      WORKERS_CI_BUILD_UUID: '552b8624-d26c-47ff-a6f1-a967152e872a',
    },
    sha,
    now
  );
  assert.match(
    record.buildUrl!,
    /view\/willie-page-preview\/production\/builds\//
  );
});

test('a GitHub build links to the producing run rather than the latest workflow', () => {
  const record = createBuildRecord(
    {
      NODE_ENV: 'production',
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'WillieCubed/website',
      GITHUB_RUN_ID: '12345',
      GITHUB_SHA: sha,
    },
    null,
    now
  );
  assert.equal(
    record.buildUrl,
    'https://github.com/WillieCubed/website/actions/runs/12345'
  );
  assert.equal(record.revision, sha);
  assert.equal(record.builtAt, '2026-10-14T16:30:00.000Z');
});

test('local builds have an honest source revision and no invented CI record', () => {
  const record = createBuildRecord({ NODE_ENV: 'production' }, sha, now);
  assert.equal(record.revision, sha);
  assert.equal(record.buildUrl, null);
  assert.equal(record.provider, null);
  assert.equal(record.development, false);
});

test('development does not present a server start time as a completed build', () => {
  const record = createBuildRecord({ NODE_ENV: 'development' }, sha, now);
  assert.equal(record.builtAt, null);
  assert.equal(record.development, true);
});

test('invalid provenance fails the build instead of publishing a misleading record', () => {
  assert.throws(
    () =>
      createBuildRecord(
        { NODE_ENV: 'production', SITE_BUILT_AT: 'yesterday' },
        sha,
        now
      ),
    /build time/i
  );
  assert.throws(
    () => createBuildRecord({ NEXT_PUBLIC_SITE_REVISION: 'main' }, null, now),
    /revision/i
  );
  assert.throws(
    () =>
      createBuildRecord(
        { WORKERS_CI: '1', WORKERS_CI_BUILD_UUID: '../other' },
        sha,
        now
      ),
    /build identifier/i
  );
});

test('the revision endpoint and plain-text credits use the same baked artifact record', async () => {
  const previous = process.env.SITE_BUILD_RECORD;
  try {
    process.env.SITE_BUILD_RECORD = JSON.stringify(
      createBuildRecord(
        { NODE_ENV: 'production', SITE_BUILT_AT: '2026-10-14T03:00:00.000Z' },
        sha,
        now
      )
    );
    const response = await revision().json();
    assert.equal(response.sha, sha);
    assert.equal(response.builtAt, '2026-10-14T03:00:00.000Z');
    assert.match(await humans().text(), /^Last update: 2026\/10\/13$/m);
  } finally {
    if (previous === undefined) delete process.env.SITE_BUILD_RECORD;
    else process.env.SITE_BUILD_RECORD = previous;
  }
});
