import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { CaptureLedger } from '../../../e2e/publishing/atproto/capture/ledger.mts';

const publisher = 'did:plc:publisher';
const visitor = 'did:plc:visitor';
const token = 'a'.repeat(64);
const sessionHash = createHash('sha256').update(token).digest('hex');
const identity = { did: visitor, sessionHash, grantCreated: true };
const record = {
  uri: `at://${visitor}/site.standard.graph.subscription/owned`,
  cid: 'owned-cid',
  kind: 'subscription' as const,
  target: `at://${publisher}/site.standard.publication/fixture`,
};
async function fixture() {
  const output = await mkdtemp(join(tmpdir(), 'capture-ledger-'));
  const options = {
    output,
    origin: 'https://fixture.example',
    publisher,
    forbiddenOwner: 'did:plc:production',
  };
  return { output, options, ledger: new CaptureLedger(options) };
}

test('browser ownership is recoverable before record discovery, and credentials stay private', async () => {
  const { output, options, ledger } = await fixture();
  try {
    await ledger.beginInventory(identity, token);
    const partial = JSON.parse(
      await readFile(join(output, 'cleanup-ownership.json'), 'utf8')
    );
    assert.equal(partial.owned[0].inventoryComplete, false);
    assert.deepEqual(partial.owned[0].records, []);
    assert.equal(JSON.stringify(partial).includes(token), false);
    const credentials = JSON.parse(
      await readFile(join(output, 'cleanup-credentials.json'), 'utf8')
    );
    assert.equal(credentials.browserTokens[sessionHash], token);
    assert.equal(
      (await stat(join(output, 'cleanup-credentials.json'))).mode & 0o777,
      0o600
    );
    const recovered = new CaptureLedger(options);
    await recovered.restoreBrowsers();
    assert.equal(recovered.browser(sessionHash)?.inventoryComplete, false);
    await recovered.completeInventory(sessionHash, [record]);
    const complete = JSON.parse(
      await readFile(join(output, 'cleanup-ownership.json'), 'utf8')
    );
    assert.equal(complete.owned[0].inventoryComplete, true);
    assert.equal(complete.owned[0].records[0].cid, 'owned-cid');
    const snapshot = recovered.browser(sessionHash)!;
    snapshot.records.length = 0;
    assert.equal(recovered.browser(sessionHash)?.records.length, 1);
    await recovered.withBrowserToken(sessionHash, async (value) =>
      assert.equal(value, token)
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('grant intent must match a persisted issued state before callback delivery is bound', async () => {
  const { output, options, ledger } = await fixture();
  const state = {
    key: 'b'.repeat(64),
    did: publisher,
    encryptedHash: 'c'.repeat(64),
    flowHash: 'd'.repeat(64),
  };
  const intent = {
    did: publisher,
    stateHash: state.key,
    encryptedStateHash: state.encryptedHash,
    flowHash: state.flowHash,
    dpopSpkiSha256: 'e'.repeat(64),
    issuer: 'https://provider.example',
    audience: 'https://provider.example/',
    kind: 'subscription' as const,
    beforeRecords: [],
    beforeBrowsers: [],
    priorGrantKeys: [],
  };
  try {
    await assert.rejects(ledger.beginGrant(intent));
    await ledger.recordIssuedState(state);
    await ledger.beginGrant(intent);
    const pending = JSON.parse(
      await readFile(join(output, 'pending-grants.json'), 'utf8')
    );
    assert.equal(pending.pending[0].callbackCompleted, undefined);
    await assert.rejects(
      ledger.recordCallback(state.key, {
        actualStatus: 500,
        setCookie: `atproto_session=${token}; Secure`,
      })
    );
    await ledger.recordCallback(state.key, {
      actualStatus: 303,
      setCookie: `atproto_session=${token}; Secure`,
    });
    const callback = JSON.parse(
      await readFile(join(output, `pending-callback-${state.key}.json`), 'utf8')
    );
    assert.equal(callback.actualStatus, 303);
    const recovered = new CaptureLedger(options);
    await recovered.restoreIssuedStates();
    await recovered.restorePendingGrants();
    assert.equal(recovered.pendingGrants()[0].responseSessionHash, sessionHash);
    assert.equal(recovered.pendingGrants()[0].callbackCompleted, true);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('foreign records, changed owned CIDs, and premature revocation cannot advance cleanup', async () => {
  const { output, ledger } = await fixture();
  try {
    await ledger.beginInventory(identity, token);
    await assert.rejects(
      ledger.completeInventory(sessionHash, [
        {
          ...record,
          uri: 'at://did:plc:foreign/site.standard.graph.subscription/owned',
        },
      ])
    );
    assert.equal(ledger.browser(sessionHash)?.inventoryComplete, false);
    await ledger.completeInventory(sessionHash, [record]);
    await assert.rejects(
      ledger.mergeRecords(sessionHash, [{ ...record, cid: 'changed-cid' }])
    );
    await assert.rejects(ledger.markGrantRevoked(sessionHash));
    await ledger.beginMutation(sessionHash, 'subscription', record.target, [
      { uri: record.uri, cid: record.cid },
    ]);
    await ledger.markMutationDispatched(sessionHash, 'subscription');
    assert(ledger.browser(sessionHash)?.pendingMutation?.dispatchedAt);
    await ledger.completeMutation(sessionHash, []);
    await ledger.markRecordsClean(sessionHash, true);
    await ledger.markGrantRevoked(sessionHash);
    assert.equal(ledger.browser(sessionHash)?.grantRevoked, true);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('failed persistence blocks the transition and leaves the previous inventory recoverable', async () => {
  const { output, options, ledger } = await fixture();
  try {
    await ledger.beginInventory(identity, token);
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(output, 'cleanup-ownership.json.new'));
    await assert.rejects(ledger.completeInventory(sessionHash, [record]));
    assert.equal(ledger.browser(sessionHash)?.inventoryComplete, false);
    assert.deepEqual(ledger.browser(sessionHash)?.records, []);
    await rm(join(output, 'cleanup-ownership.json.new'), { recursive: true });
    const other = new CaptureLedger(options);
    await other.restoreBrowsers();
    assert.equal(other.browser(sessionHash)?.inventoryComplete, false);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('concurrent inventory additions serialize without losing an already journaled record', async () => {
  const { output, options, ledger } = await fixture();
  try {
    await ledger.beginInventory(identity, token);
    await ledger.completeInventory(sessionHash, []);
    await Promise.all([
      ledger.mergeRecords(sessionHash, [record]),
      ledger.mergeRecords(sessionHash, [
        {
          ...record,
          uri: `at://${visitor}/site.standard.graph.subscription/second`,
          cid: 'second-cid',
        },
      ]),
    ]);
    const recovered = new CaptureLedger(options);
    await recovered.restoreBrowsers();
    assert.deepEqual(
      recovered.browser(sessionHash)?.records.map((entry) => entry.cid),
      ['owned-cid', 'second-cid']
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('observed callback survives an interrupted grant checkpoint and can finish recovery', async () => {
  const { output, options, ledger } = await fixture();
  const state = {
    key: 'b'.repeat(64),
    did: publisher,
    encryptedHash: 'c'.repeat(64),
    flowHash: 'd'.repeat(64),
  };
  const intent = {
    did: publisher,
    stateHash: state.key,
    encryptedStateHash: state.encryptedHash,
    flowHash: state.flowHash,
    dpopSpkiSha256: 'e'.repeat(64),
    issuer: 'https://provider.example',
    audience: 'https://provider.example/',
    kind: 'subscription' as const,
    beforeRecords: [],
    beforeBrowsers: [],
    priorGrantKeys: [],
  };
  try {
    await ledger.recordIssuedState(state);
    await assert.rejects(ledger.recordIssuedState({ ...state, did: visitor }));
    await assert.rejects(
      ledger.beginGrant({ ...intent, audience: 'https://foreign.example/' })
    );
    await ledger.beginGrant(intent);
    const { mkdir } = await import('node:fs/promises');
    const interrupted = join(output, 'pending-grants.json.new');
    await mkdir(interrupted);
    await assert.rejects(
      ledger.recordCallback(state.key, {
        actualStatus: 303,
        setCookie: `atproto_session=${token}; Secure`,
      })
    );
    assert.equal(ledger.pendingGrants()[0].callbackCompleted, undefined);
    const callback = JSON.parse(
      await readFile(join(output, `pending-callback-${state.key}.json`), 'utf8')
    );
    assert.equal(callback.actualStatus, 303);
    await rm(interrupted, { recursive: true });
    const recovered = new CaptureLedger(options);
    await recovered.restoreIssuedStates();
    await recovered.restorePendingGrants();
    assert.equal(recovered.pendingGrants()[0].callbackCompleted, undefined);
    await recovered.recordCallback(state.key, callback);
    assert.equal(recovered.pendingGrants()[0].responseSessionHash, sessionHash);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('failed partial-inventory checkpoint keeps the observed browser visible to finally cleanup', async () => {
  const { output, ledger } = await fixture();
  try {
    await ledger.initialize();
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(output, 'cleanup-ownership.json.new'));
    await assert.rejects(ledger.beginInventory(identity, token));
    const observed = ledger.browser(sessionHash);
    assert.equal(observed?.did, visitor);
    assert.equal(observed?.inventoryComplete, false);
    await ledger.withBrowserToken(sessionHash, async (credential) =>
      assert.equal(credential, token)
    );
    const persistedCredentials = JSON.parse(
      await readFile(join(output, 'cleanup-credentials.json'), 'utf8')
    );
    assert.equal(persistedCredentials.browserTokens[sessionHash], token);
    await rm(join(output, 'cleanup-ownership.json.new'), { recursive: true });
    await assert.rejects(
      ledger.beginMutation(sessionHash, 'subscription', record.target, []),
      /inventory/i
    );
    await ledger.markRecordsClean(sessionHash, false);
    const cleanup = JSON.parse(
      await readFile(join(output, 'cleanup-ownership.json'), 'utf8')
    );
    assert.equal(cleanup.owned[0].did, visitor);
    assert.equal(cleanup.owned[0].recordsClean, false);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('failed mutation-intent checkpoint cannot authorize a dispatch', async () => {
  const { output, ledger } = await fixture();
  try {
    await ledger.beginInventory(identity, token);
    await ledger.completeInventory(sessionHash, [record]);
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(output, 'cleanup-ownership.json.new'));
    await assert.rejects(
      ledger.beginMutation(sessionHash, 'subscription', record.target, [
        { uri: record.uri, cid: record.cid },
      ])
    );
    assert.equal(ledger.browser(sessionHash)?.pendingMutation, undefined);
    await rm(join(output, 'cleanup-ownership.json.new'), { recursive: true });
    await assert.rejects(
      ledger.markMutationDispatched(sessionHash, 'subscription')
    );
    const persisted = JSON.parse(
      await readFile(join(output, 'cleanup-ownership.json'), 'utf8')
    );
    assert.equal(persisted.owned[0].inventoryComplete, true);
    assert.equal(persisted.owned[0].pendingMutation, undefined);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
