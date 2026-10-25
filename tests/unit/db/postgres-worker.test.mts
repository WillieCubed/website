import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Client } from 'pg';

import { createPool } from '../../../lib/db/postgres';

function workerPool(context: TestContext) {
  const key = Symbol.for('__cloudflare-context__');
  const original = Reflect.get(globalThis, key);
  Reflect.set(globalThis, key, {
    env: {
      HYPERDRIVE: {
        connectionString: 'postgresql://unused:unused@127.0.0.1:1/unused',
      },
    },
  });
  context.after(() => {
    if (original === undefined) Reflect.deleteProperty(globalThis, key);
    else Reflect.set(globalThis, key, original);
  });
  return createPool();
}

test('a refused Worker connection reaches its caller without waiting for a socket close', async (context) => {
  const pool = workerPool(context);
  const refused = new Error('connection refused');
  context.mock.method(Client.prototype, 'connect', async () => {
    throw refused;
  });
  // pg-cloudflare can reject socket.closed without emitting the close event
  // that Client.end() awaits after a failed connection.
  const end = context.mock.method(
    Client.prototype,
    'end',
    () => new Promise<void>(() => {})
  );
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    await assert.rejects(
      Promise.race([
        pool.query('SELECT 1'),
        new Promise((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error('The rejected connection stayed pending.')),
            100
          );
        }),
      ]),
      (error) => error === refused
    );
    assert.equal(end.mock.callCount(), 0);
  } finally {
    clearTimeout(deadline);
  }
});

for (const fails of [false, true]) {
  test(`a connected Worker client finishes cleanup before ${fails ? 'rejecting' : 'returning'} its query`, async (context) => {
    const pool = workerPool(context);
    const failure = new Error('query failed');
    const result = { rows: [{ value: 1 }], rowCount: 1 };
    context.mock.method(Client.prototype, 'connect', async () => {});
    context.mock.method(Client.prototype, 'query', async () => {
      if (fails) throw failure;
      return result;
    });
    let finishCleanup = () => {};
    let cleanupStarted = () => {};
    const started = new Promise<void>((resolve) => {
      cleanupStarted = resolve;
    });
    const cleanup = new Promise<void>((resolve) => {
      finishCleanup = resolve;
    });
    const end = context.mock.method(Client.prototype, 'end', () => {
      cleanupStarted();
      return cleanup;
    });
    let settled = false;
    const request = pool.query('SELECT $1::int AS value', [1]);
    void request.then(
      () => (settled = true),
      () => (settled = true)
    );
    await started;
    assert.equal(settled, false);
    assert.equal(end.mock.callCount(), 1);
    finishCleanup();
    if (fails) await assert.rejects(request, (error) => error === failure);
    else assert.equal(await request, result);
  });
}
