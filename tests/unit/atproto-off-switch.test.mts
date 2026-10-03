import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';

// Module-level config is read once per process, so the off state needs a
// fresh one: the fixture DID stays set and only the publication key is
// emptied, the case where pages must not name records the sync never writes.
const probe = `
  import { PUBLICATION_URI } from '@/lib/atproto/config';
  import { documentUri } from '@/lib/atproto/keys';
  import { buildLlmsSummary } from '@/lib/indieweb/discovery';
  import { syncAtproto } from '@/lib/atproto/sync';
  const { GET } = await import('@/app/.well-known/site.standard.publication/route');
  console.log(JSON.stringify({
    publicationUri: PUBLICATION_URI ?? null,
    documentUri: documentUri('/writings/a', new Date('2026-10-01T12:00:00Z')) ?? null,
    wellKnownStatus: (await GET()).status,
    llms: buildLlmsSummary(),
    sync: await syncAtproto({ writings: [], fetchImage: async () => null }),
  }));
`;

test('without a publication key the whole feature turns itself off', () => {
  const run = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', probe],
    {
      cwd: resolve(import.meta.dirname, '../..'),
      encoding: 'utf8',
      env: { ...process.env, ATPROTO_PUBLICATION_RKEY: '' },
    }
  );
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout.trim().split('\n').pop() ?? '');
  assert.equal(result.publicationUri, null);
  assert.equal(result.documentUri, null);
  assert.equal(result.wellKnownStatus, 404);
  assert.equal(result.sync.status, 'skipped');
  assert.ok(result.llms.includes('/.well-known/atproto-did'));
  assert.ok(!result.llms.includes('/.well-known/site.standard.publication'));
});
