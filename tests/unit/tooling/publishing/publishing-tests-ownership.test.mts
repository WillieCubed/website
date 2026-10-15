import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { CaptureLedger } from '../../../e2e/publishing/atproto/capture/ledger.mts';
import { settleUiMutation } from '../../../e2e/publishing/atproto/capture/settle-mutation.mts';
import {
  ACCOUNT,
  DOMAIN,
  IMAGE,
  OWNER,
} from '../../../support/publishing/identities/config.mts';
import {
  privateWrite,
  validate,
} from '../../../support/publishing/identities/journal.mts';
import type { Journal } from '../../../support/publishing/identities/types.mts';

function journal(path: string): Journal {
  const run = '0123456789';
  return {
    version: 1,
    account: ACCOUNT,
    domain: DOMAIN,
    run,
    marker: 'a'.repeat(64),
    origin: `https://willie-pds-${run}.${DOMAIN}`,
    container: `dev-williecubed-website-pds-${run}`,
    port: 12345,
    image: IMAGE,
    data: join(path, 'pds'),
    adminPassword: 'fixture',
    jwtSecret: 'fixture',
    rotationKey: 'fixture',
    workers: [],
    publisher: {
      handle: `pub${run}.${DOMAIN}`,
      email: 'pub@example.invalid',
      password: 'fixture',
    },
    visitor: {
      handle: `vis${run}.${DOMAIN}`,
      email: 'vis@example.invalid',
      password: 'fixture',
    },
    started: '2026-10-01T00:00:00.000Z',
  };
}

test('legacy ownership journals remain valid and foreign resources are refused', () => {
  const dir = join(tmpdir(), 'owned-acceptance');
  const owned = journal(dir),
    path = join(dir, 'ownership.json');
  assert.doesNotThrow(() => validate(owned, path));
  assert.throws(() =>
    validate({ ...owned, data: join(tmpdir(), 'foreign') }, path)
  );
  assert.throws(() =>
    validate({ ...owned, publisher: { ...owned.publisher, did: OWNER } }, path)
  );
  assert.throws(() =>
    validate(
      {
        ...owned,
        workers: [{ name: 'foreign', source: owned.marker, versions: [] }],
      },
      path
    )
  );
});

test('private journal replacement recovers a stale temporary write and retains private permissions', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'private-journal-'));
  const path = join(dir, 'ownership.json');
  try {
    await privateWrite(path, 'previous');
    await writeFile(`${path}.new`, 'interrupted');
    await privateWrite(path, 'next');
    assert.equal(await readFile(path, 'utf8'), 'next');
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    await assert.rejects(stat(`${path}.new`), { code: 'ENOENT' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const publisher = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
async function ownedBrowser() {
  const output = await mkdtemp(join(tmpdir(), 'capture-mutation-'));
  const ledger = new CaptureLedger({
    output,
    origin: 'https://fixture.example',
    publisher,
    forbiddenOwner: OWNER,
  });
  const token = 'a'.repeat(64);
  const sessionHash = createHash('sha256').update(token).digest('hex');
  const did = 'did:plc:bbbbbbbbbbbbbbbbbbbbbbbb';
  const record = {
    uri: `at://${did}/site.standard.graph.subscription/owned`,
    cid: 'known',
    kind: 'subscription' as const,
    target: `at://${publisher}/site.standard.publication/key`,
  };
  await ledger.beginInventory({ did, sessionHash, grantCreated: true }, token);
  await ledger.completeInventory(sessionHash, [record]);
  await ledger.beginMutation(sessionHash, 'subscription', record.target, []);
  await ledger.markMutationDispatched(
    sessionHash,
    'subscription',
    '2000-01-01T00:00:00.000Z'
  );
  return { output, ledger, owner: ledger.browser(sessionHash)! };
}

test('interrupted mutation recovery journals only a stable, already owned record', async () => {
  const { output, ledger, owner } = await ownedBrowser();
  try {
    await settleUiMutation(
      {
        settings: { NEXT_PUBLIC_ATPROTO_DID: publisher },
        graphFor: async () => [
          { uri: owner.records[0].uri, cid: 'known', value: {} },
        ],
        ledger,
        lock: async (key, work) => {
          assert.equal(
            key,
            `social:${owner.did}:subscription:at://${publisher}/site.standard.publication/key`
          );
          return work();
        },
      },
      owner
    );
    const saved = JSON.parse(
      await readFile(join(output, 'cleanup-ownership.json'), 'utf8')
    );
    assert(saved.owned[0].pendingMutation.quiescedAt);
    assert.equal(owner.pendingMutation?.quiescedAt, undefined);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('interrupted mutation recovery refuses adoption or revocation of an unjournaled result', async () => {
  const { output, ledger, owner } = await ownedBrowser();
  try {
    await assert.rejects(
      settleUiMutation(
        {
          settings: { NEXT_PUBLIC_ATPROTO_DID: publisher },
          graphFor: async () => [
            { uri: 'at://reader/record/foreign', cid: 'foreign', value: {} },
          ],
          ledger,
          lock: async (_key, work) => work(),
        },
        owner
      ),
      /unjournaled/
    );
    const saved = JSON.parse(
      await readFile(join(output, 'cleanup-ownership.json'), 'utf8')
    );
    assert.equal(saved.owned[0].pendingMutation.quiescedAt, undefined);
    assert.equal(ledger.browser(owner.sessionHash)?.grantRevoked, undefined);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
