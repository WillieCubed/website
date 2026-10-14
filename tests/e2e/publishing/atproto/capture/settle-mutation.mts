import type {} from '@atcute/atproto';
import assert from 'node:assert/strict';

import type { OwnedBrowser } from './types.mts';

interface Context {
  lock?: <T>(key: string, operation: () => Promise<T>) => Promise<T>;
  settings: Record<string, string>;
  graphFor: (
    did: string,
    action?: 'subscription' | 'recommendation',
    targetOnly?: boolean
  ) => Promise<{ uri: string; cid: string; value: Record<string, unknown> }[]>;
  journalOwnership: () => Promise<void>;
}

export async function settleUiMutation(
  dependencies: Context,
  owner: OwnedBrowser
) {
  const intent = owner.pendingMutation;
  assert(
    intent &&
      intent.target.startsWith(
        `at://${dependencies.settings.NEXT_PUBLIC_ATPROTO_DID}/site.standard.`
      )
  );
  if (!intent.dispatchedAt || intent.responseCompletedAt) return;
  assert.equal(
    new Date(intent.dispatchedAt).toISOString(),
    intent.dispatchedAt
  );
  // A client timeout does not cancel the deployed 60-second mutation handler.
  const until = Date.parse(intent.dispatchedAt) + 130000;
  while (Date.now() < until)
    await new Promise<void>((done) =>
      setTimeout(done, Math.min(10000, until - Date.now()))
    );
  const withOAuthLock =
    dependencies.lock ??
    (await import('../../../../../lib/atproto/oauth-storage')).withOAuthLock;
  await withOAuthLock(
    `social:${owner.did}:${intent.kind}:${intent.target}`,
    async () => {
      const current = await dependencies.graphFor(owner.did, intent.kind);
      assert(
        current.length <= 1,
        'Ambiguous matching records require manual recovery.'
      );
      for (const before of intent.before) {
        const record = current.find((value) => value.uri === before.uri);
        if (record)
          assert.equal(
            record.cid,
            before.cid,
            'A prior record changed outside the owned mutation.'
          );
      }
      for (const record of current) {
        const known = owner.records.find((value) => value.uri === record.uri);
        if (known)
          assert.equal(
            record.cid,
            known.cid,
            'An owned record changed outside this run.'
          );
        else
          throw new Error(
            'A timed-out mutation produced an unjournaled matching record. Preserve the intent and credentials; refuse adoption or revocation.'
          );
      }
    }
  );
  intent.quiescedAt = new Date().toISOString();
  await dependencies.journalOwnership();
}
