import { GET } from '@/app/api/indieweb/revision/route';
import assert from 'node:assert/strict';
import test from 'node:test';

test('the revision identifies a Worker only when its deployment bindings exist', async () => {
  const contextKey = Symbol.for('__cloudflare-context__');
  const previousContext = Reflect.get(globalThis, contextKey);
  try {
    Reflect.deleteProperty(globalThis, contextKey);
    const local = await GET().json();
    assert.equal(local.runtime, 'other');

    Reflect.set(globalThis, contextKey, {
      env: { HYPERDRIVE: {}, MEDIA_BUCKET: {}, ASSETS: {} },
    });
    const worker = await GET().json();
    assert.equal(worker.runtime, 'cloudflare-workers');
  } finally {
    if (previousContext === undefined)
      Reflect.deleteProperty(globalThis, contextKey);
    else Reflect.set(globalThis, contextKey, previousContext);
  }
});
