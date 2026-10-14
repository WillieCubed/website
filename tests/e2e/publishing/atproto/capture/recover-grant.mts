import type {} from '@atcute/atproto';
import type { StoredSession } from '@atcute/oauth-node-client';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { loadOwnedAcceptanceIdentities } from '../../../../support/publishing/identities/run.mts';
import type {
  AuthorizationBaseline,
  OwnedBrowser,
  PendingGrant,
} from './types.mts';

interface Context {
  ownedIdentities:
    | import('../../../../support/publishing/identities/run.mts').AcceptanceIdentities
    | undefined;
  settings: Record<string, string>;
  authorizationStates: {
    key: string;
    did: string;
    encryptedHash: string;
    flowHash: string;
  }[];
  ownership: OwnedBrowser[];
  authorizationBaseline: AuthorizationBaseline | undefined;
  hash: (value: string) => string;
  values: {
    workspace?: string | undefined;
    slug?: string | undefined;
    env: string;
    output: string;
    'refresh-wait-seconds': string;
    'cleanup-only': boolean;
    'defer-bluesky': boolean;
    'authorization-only': boolean;
    'cookie-delivery-failure': boolean;
    'social-only': boolean;
    'fixture-source-journal'?: string | undefined;
    'fixture-publication-journal'?: string | undefined;
    'social-runtime-revision'?: string | undefined;
  };
  journalPendingGrants: () => Promise<void>;
  db: ReturnType<typeof import('../../../../../lib/db/postgres').createPool>;
  assertGrantBinding: (intent: PendingGrant, stored: StoredSession) => void;
  decryptOAuthValue: <T>(value: string, key: string) => T;
  browserTokens: Map<string, string>;
  journalOwnership: () => Promise<void>;
  graphFor: (
    did: string,
    action?: 'subscription' | 'recommendation',
    targetOnly?: boolean
  ) => Promise<{ uri: string; cid: string; value: Record<string, unknown> }[]>;
}

export async function recoverPendingGrant(
  dependencies: Context,
  intent: PendingGrant
) {
  const identities =
    dependencies.ownedIdentities ??
    (await loadOwnedAcceptanceIdentities(
      dependencies.settings.ATPROTO_ACCEPTANCE_IDENTITIES_JOURNAL,
      dependencies.settings.NEXT_PUBLIC_ATPROTO_DID
    ));
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
      dependencies.authorizationStates.some(
        (state) =>
          state.key === intent.stateHash &&
          state.did === intent.did &&
          state.flowHash === intent.flowHash &&
          state.encryptedHash === intent.encryptedStateHash
      ),
    'Pending grant must match this run’s preexchange state and isolated provider.'
  );
  const terminal = dependencies.ownership.find(
    (owner) => owner.sessionHash === intent.responseSessionHash
  );
  if (terminal?.grantRevoked) {
    assert(
      terminal.recordsClean &&
        terminal.inventoryComplete &&
        terminal.dpopSpkiSha256 === intent.dpopSpkiSha256
    );
    return;
  }
  assert(
    [identities.publisher.did, identities.visitor.did].includes(intent.did)
  );
  if (dependencies.authorizationBaseline)
    assert(
      !dependencies.authorizationBaseline.database.grants.some(
        (row) => row.key === dependencies.hash(intent.did)
      )
    );
  if (!intent.callbackCompleted) {
    const completed = JSON.parse(
      await readFile(
        resolve(
          dependencies.values.output!,
          `pending-callback-${intent.stateHash}.json`
        ),
        'utf8'
      )
    ) as {
      callbackCompleted: boolean;
      stateHash: string;
      actualStatus: number;
      setCookie: string;
    };
    assert(
      completed.callbackCompleted &&
        completed.stateHash === intent.stateHash &&
        completed.actualStatus === 303
    );
    const token = completed.setCookie.match(
      /^atproto_session=([a-f0-9]{64})(?:;|$)/
    )?.[1];
    assert(token);
    intent.callbackCompleted = true;
    intent.responseSessionHash = dependencies.hash(token);
    await dependencies.journalPendingGrants();
  }
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
  const known = dependencies.ownership.find(
    (owner) => owner.sessionHash === intent.responseSessionHash
  );
  if (known) assert.equal(known.dpopSpkiSha256, intent.dpopSpkiSha256);
  if (known?.inventoryComplete && stored.rows.length) return;
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
  if (browserRow.rows.length) assert.equal(browserRow.rows[0].did, intent.did);
  const owner: OwnedBrowser = known ?? {
    did: intent.did,
    sessionHash: intent.responseSessionHash,
    grantCreated: true,
    dpopSpkiSha256: intent.dpopSpkiSha256,
    sessionSource: 'callback-response',
    inventoryComplete: false,
    records: [],
  };
  if (!known) dependencies.ownership.push(owner);
  dependencies.browserTokens.set(owner.sessionHash, token);
  await dependencies.journalOwnership();
  owner.records = (await dependencies.graphFor(intent.did, intent.kind))
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
  owner.inventoryComplete = true;
  await dependencies.journalOwnership();
}
