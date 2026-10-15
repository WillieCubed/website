import assert from 'node:assert/strict';

import type { PendingGrant } from './types.mts';

/** Require the observed callback, response-bound grant and subscription to belong to this run. */
export function assertDeliveryProbe(
  probe: Record<string, unknown>,
  pending: readonly Pick<PendingGrant, 'did' | 'stateHash' | 'dpopSpkiSha256'>[]
): void {
  assert(
    probe.scope === 'real-callback-browser-delivery-failure' &&
      probe.actualCallbackStatus === 303 &&
      probe.browserSessionAbsent &&
      probe.providerGrantBoundToIssuedState &&
      probe.browserRowBoundToActualResponse &&
      probe.actualSubscriptionPresent &&
      pending.some(
        (intent) =>
          intent.did === probe.did &&
          intent.stateHash === probe.stateHash &&
          intent.dpopSpkiSha256 === probe.dpopSpkiSha256
      )
  );
}
