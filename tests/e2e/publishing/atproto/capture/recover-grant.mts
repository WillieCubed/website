import type {} from '@atcute/atproto';
import type { StoredSession } from '@atcute/oauth-node-client';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { PostgresPool } from '../../../../../lib/db/postgres';
import { loadOwnedAcceptanceIdentities } from '../../../../support/publishing/identities/run.mts';
import type { AcceptanceIdentities } from '../../../../support/publishing/identities/types.mts';
import type { CaptureLedger } from './ledger.mts';
import type {
  AuthorizationBaseline,
  CaptureGraphReader,
  CaptureOptions,
  OwnedBrowser,
  PendingCallbackReceipt,
  PendingGrant,
} from './types.mts';

interface Context {
  ownedIdentities: AcceptanceIdentities | undefined;
  settings: Record<string, string>;
  ledger: CaptureLedger;
  authorizationBaseline: AuthorizationBaseline | undefined;
  hash: (value: string) => string;
  values: CaptureOptions;
  db: PostgresPool;
  assertGrantBinding: (intent: PendingGrant, stored: StoredSession) => void;
  decryptOAuthValue: <T>(value: string, key: string) => T;
  graphFor: CaptureGraphReader;
}

export async function recoverPendingGrant(
  dependencies: Readonly<Context>,
  intent: PendingGrant
) {
  const identities =
    dependencies.ownedIdentities ??
    (await loadOwnedAcceptanceIdentities(
      dependencies.settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
      dependencies.settings.NEXT_PUBLIC_ATPROTO_DID
    ));
  assertPreexchangeOwnership();
  if (revokedGrantAlreadyClean()) return;
  assert(
    [identities.publisher.did, identities.visitor.did].includes(intent.did)
  );
  if (dependencies.authorizationBaseline)
    assert(
      !dependencies.authorizationBaseline.database.grants.some(
        (row) => row.key === dependencies.hash(intent.did)
      )
    );
  await completeCallbackInventory();
  const stored = await dependencies.db
    .sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${dependencies.hash(intent.did)}`;
  assert(stored.rows.length <= 1);
  if (stored.rows.length)
    dependencies.assertGrantBinding(
      intent,
      dependencies.decryptOAuthValue<StoredSession>(
        stored.rows[0].encrypted_value as string,
        dependencies.settings.ATPROTO_OAUTH_STORAGE_KEY
      )
    );
  assert(
    intent.callbackCompleted && intent.responseSessionHash,
    'An unfinished callback or missing server response cannot authorize browser/record cleanup.'
  );
  const known = dependencies.ledger
    .browsers()
    .find((owner) => owner.sessionHash === intent.responseSessionHash);
  if (known) assert.equal(known.dpopSpkiSha256, intent.dpopSpkiSha256);
  if (known?.inventoryComplete && stored.rows.length) return;
  await recoverBrowserInventory();
  function revokedGrantAlreadyClean(): boolean {
    const terminal = dependencies.ledger
      .browsers()
      .find((owner) => owner.sessionHash === intent.responseSessionHash);
    if (terminal?.grantRevoked) {
      assert(
        terminal.recordsClean &&
          terminal.inventoryComplete &&
          terminal.dpopSpkiSha256 === intent.dpopSpkiSha256
      );
      return true;
    }

    return false;
  }
  function assertPreexchangeOwnership(): void {
    assert.deepEqual(intent.priorGrantKeys, []);
    assert(
      intent.kind === 'subscription' &&
        intent.did === identities.publisher.did &&
        intent.issuer === identities.origin &&
        intent.audience === new URL(identities.origin).href &&
        [
          intent.stateHash,
          intent.flowHash,
          intent.encryptedStateHash,
          intent.dpopSpkiSha256,
        ].every((value) => /^[a-f0-9]{64}$/.test(value)) &&
        intent.beforeRecords.length === 0 &&
        dependencies.ledger
          .issuedStates()
          .some(
            (state) =>
              state.key === intent.stateHash &&
              state.did === intent.did &&
              state.flowHash === intent.flowHash &&
              state.encryptedHash === intent.encryptedStateHash
          ),
      'Pending grant must match this run’s preexchange state and isolated provider.'
    );
  }
  async function completeCallbackInventory(): Promise<void> {
    if (!intent.callbackCompleted) {
      const completed = JSON.parse(
        await readFile(
          resolve(
            dependencies.values.output!,
            `pending-callback-${intent.stateHash}.json`
          ),
          'utf8'
        )
      ) as PendingCallbackReceipt;
      assert(
        completed.callbackCompleted &&
          completed.stateHash === intent.stateHash &&
          completed.actualStatus === 303
      );
      const token = completed.setCookie.match(
        /^atproto_session=([a-f0-9]{64})(?:;|$)/
      )?.[1];
      assert(token);
      intent = await dependencies.ledger.recordCallback(
        intent.stateHash,
        completed
      );
    }
  }
  async function recoverBrowserInventory(): Promise<void> {
    const actual = JSON.parse(
      await readFile(
        resolve(
          dependencies.values.output!,
          `pending-callback-${intent.stateHash}.json`
        ),
        'utf8'
      )
    ) as { setCookie: string };
    const token = actual.setCookie.match(
      /^atproto_session=([a-f0-9]{64})(?:;|$)/
    )?.[1];
    assert(token && dependencies.hash(token) === intent.responseSessionHash);
    assert(!intent.beforeBrowsers.includes(intent.responseSessionHash));
    const browserRow = await dependencies.db
      .sql`SELECT did FROM atproto_browser_sessions WHERE token_hash = ${intent.responseSessionHash}`;
    assert(
      browserRow.rows.length === 1 || (known && browserRow.rows.length === 0)
    );
    if (browserRow.rows.length)
      assert.equal(browserRow.rows[0].did, intent.did);
    const owner: OwnedBrowser = known ?? {
      did: intent.did,
      sessionHash: intent.responseSessionHash,
      grantCreated: true,
      dpopSpkiSha256: intent.dpopSpkiSha256,
      sessionSource: 'callback-response',
      inventoryComplete: false,
      records: [],
    };
    await dependencies.ledger.beginInventory(owner, token);
    const records = (await dependencies.graphFor(intent.did, intent.kind))
      .filter(
        (record) =>
          !intent.beforeRecords.some((before) => before.uri === record.uri)
      )
      .map((record) => ({
        uri: record.uri,
        cid: record.cid,
        kind: intent.kind,
        target: record.value[
          intent.kind === 'subscription' ? 'publication' : 'document'
        ] as string,
      }));
    await dependencies.ledger.completeInventory(owner.sessionHash, records);
  }
}
