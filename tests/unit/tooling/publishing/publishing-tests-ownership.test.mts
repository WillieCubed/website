import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { settleUiMutation } from '../../../e2e/publishing/atproto/capture/settle-mutation.mts';
import type { OwnedBrowser } from '../../../e2e/publishing/atproto/capture/types.mts';
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
function browserOwner(): OwnedBrowser {
  return {
    did: 'did:plc:bbbbbbbbbbbbbbbbbbbbbbbb',
    sessionHash: 'fixture',
    grantCreated: true,
    inventoryComplete: true,
    records: [
      {
        uri: 'at://reader/record/key',
        cid: 'known',
        kind: 'subscription',
        target: 'fixture',
      },
    ],
    pendingMutation: {
      kind: 'subscription',
      before: [],
      dispatchedAt: '2000-01-01T00:00:00.000Z',
      target: `at://${publisher}/site.standard.publication/key`,
    },
  };
}

test('interrupted mutation recovery journals only a stable, already owned record', async () => {
  const owner = browserOwner();
  const locks: string[] = [];
  let saved = 0;
  await settleUiMutation(
    {
      settings: { NEXT_PUBLIC_ATPROTO_DID: publisher },
      graphFor: async () => [
        { uri: owner.records[0].uri, cid: 'known', value: {} },
      ],
      journalOwnership: async () => {
        saved++;
      },
      lock: async (key, work) => {
        locks.push(key);
        return work();
      },
    },
    owner
  );
  assert.equal(saved, 1);
  assert.equal(locks.length, 1);
  assert.ok(owner.pendingMutation?.quiescedAt);
});

test('interrupted mutation recovery refuses adoption or revocation of an unjournaled result', async () => {
  const owner = browserOwner();
  let saved = false;
  await assert.rejects(
    settleUiMutation(
      {
        settings: { NEXT_PUBLIC_ATPROTO_DID: publisher },
        graphFor: async () => [
          { uri: 'at://reader/record/foreign', cid: 'foreign', value: {} },
        ],
        journalOwnership: async () => {
          saved = true;
        },
        lock: async (_key, work) => work(),
      },
      owner
    ),
    /unjournaled/
  );
  assert.equal(saved, false);
  assert.equal(owner.pendingMutation?.quiescedAt, undefined);
});
