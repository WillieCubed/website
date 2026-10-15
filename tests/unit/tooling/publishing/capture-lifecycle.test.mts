import assert from 'node:assert/strict';
import test from 'node:test';

import { assertDeliveryProbe } from '../../../e2e/publishing/atproto/capture/delivery-proof.mts';
import { finishCapture } from '../../../e2e/publishing/atproto/capture/finish.mts';
import type { RunContext } from '../../../e2e/publishing/atproto/capture/types.mts';

function captureState(events: string[]): RunContext {
  return {
    notificationCleanup: async () => {
      events.push('drain');
    },
    lifecycleCleanup: async () => {
      events.push('lifecycle');
    },
    sourceCleanup: async () => {
      events.push('source');
    },
    finalNotification: async () => {
      events.push('notification');
    },
    fixtureCleanup: async () => {
      events.push('fixture');
    },
    publicationCleanupVerified: false,
    browserCleanupSucceeded: true,
    phase: 'fixture',
    recoveryPath: 'private fixture',
  };
}

test('capture cleanup drains handlers before removing source and finally the publication', async () => {
  const events: string[] = [];
  const state = captureState(events);
  await finishCapture(state);
  assert.deepEqual(events, [
    'drain',
    'lifecycle',
    'source',
    'notification',
    'fixture',
  ]);
  assert.equal(state.publicationCleanupVerified, true);
});

test('a failed lifecycle retains source and publication for owned recovery', async (context) => {
  context.mock.method(console, 'error', () => {});
  const exitCode = process.exitCode;
  const events: string[] = [];
  const state = captureState(events);
  state.lifecycleCleanup = async () => {
    events.push('lifecycle');
    throw new Error('fixture failure');
  };
  try {
    await finishCapture(state);
    assert.deepEqual(events, ['drain', 'lifecycle']);
    assert.equal(process.exitCode, 1);
    assert.equal(state.publicationCleanupVerified, false);
  } finally {
    process.exitCode = exitCode;
  }
});

test('incomplete browser cleanup blocks destructive source and publication phases', async () => {
  const events: string[] = [];
  const state = captureState(events);
  state.browserCleanupSucceeded = false;
  await finishCapture(state);
  assert.deepEqual(events, ['drain', 'lifecycle']);
  assert.equal(state.publicationCleanupVerified, false);
});

test('failed final notification requires another successful drain before publication cleanup', async (context) => {
  context.mock.method(console, 'error', () => {});
  const exitCode = process.exitCode;
  const events: string[] = [];
  const state = captureState(events);
  state.finalNotification = async () => {
    events.push('notification');
    throw new Error('fixture failure');
  };
  state.notificationCleanup = async () => {
    events.push('drain');
    if (events.length > 1) throw new Error('fixture drain failure');
  };
  try {
    await finishCapture(state);
    assert.deepEqual(events, [
      'drain',
      'lifecycle',
      'source',
      'notification',
      'drain',
    ]);
    assert.equal(process.exitCode, 1);
    assert.equal(state.publicationCleanupVerified, false);
  } finally {
    process.exitCode = exitCode;
  }
});

test('delivery-loss proof refuses a foreign grant or an incomplete observed callback', () => {
  const intent = {
    did: 'did:plc:fixture',
    stateHash: 'state',
    dpopSpkiSha256: 'key',
  };
  const probe = {
    ...intent,
    scope: 'real-callback-browser-delivery-failure',
    actualCallbackStatus: 303,
    browserSessionAbsent: true,
    providerGrantBoundToIssuedState: true,
    browserRowBoundToActualResponse: true,
    actualSubscriptionPresent: true,
  };
  assert.doesNotThrow(() => assertDeliveryProbe(probe, [intent]));
  assert.throws(() =>
    assertDeliveryProbe({ ...probe, did: 'did:plc:foreign' }, [intent])
  );
  assert.throws(() =>
    assertDeliveryProbe({ ...probe, dpopSpkiSha256: 'foreign' }, [intent])
  );
  assert.throws(() =>
    assertDeliveryProbe({ ...probe, stateHash: 'foreign' }, [intent])
  );
  assert.throws(() =>
    assertDeliveryProbe({ ...probe, actualCallbackStatus: 400 }, [intent])
  );
  assert.throws(() =>
    assertDeliveryProbe({ ...probe, browserRowBoundToActualResponse: false }, [
      intent,
    ])
  );
});
