import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import {
  type BrowserSample,
  calculateCls,
  median,
  medianMetric,
  recordPreviewFailure,
} from '../../../scripts/cloudflare/preview-metrics.mts';
import {
  assertPreviewPortAvailable,
  monitorPreview,
  previewRuntimeError,
  stopPreview,
  waitUntilReady,
} from '../../../scripts/cloudflare/preview-process.mts';
import { writePreviewReport } from '../../../scripts/cloudflare/preview-report.mts';

const sample = (overrides: Partial<BrowserSample> = {}): BrowserSample => ({
  ttfbMs: 100,
  fcpMs: 250,
  lcpMs: 300,
  cls: 0.02,
  ...overrides,
});

test('median returns the middle value, including the even-count midpoint', () => {
  assert.equal(median([9, 1, 5]), 5);
  assert.equal(median([9, 1, 5, 3]), 4);
  assert.equal(median([]), null);
});

test('a route with no LCP entries reports unavailable instead of zero', () => {
  assert.equal(
    medianMetric([sample({ lcpMs: null }), sample({ lcpMs: null })], 'lcpMs'),
    null
  );
});

test('missing FCP values do not change the median of available samples', () => {
  assert.equal(
    medianMetric([sample({ fcpMs: null }), sample({ fcpMs: 200 })], 'fcpMs'),
    200
  );
});

test('CLS uses the largest session window and excludes shifts after input', () => {
  assert.equal(
    calculateCls([
      { startTime: 100, value: 0.2, hadRecentInput: false },
      { startTime: 900, value: 0.3, hadRecentInput: false },
      { startTime: 2_000, value: 0.4, hadRecentInput: false },
      { startTime: 2_100, value: 0.9, hadRecentInput: true },
    ]),
    0.5
  );
  assert.equal(
    calculateCls([
      { startTime: 0, value: 0.1, hadRecentInput: false },
      { startTime: 900, value: 0.1, hadRecentInput: false },
      { startTime: 1_800, value: 0.1, hadRecentInput: false },
      { startTime: 2_700, value: 0.1, hadRecentInput: false },
      { startTime: 3_600, value: 0.1, hadRecentInput: false },
      { startTime: 4_500, value: 0.1, hadRecentInput: false },
      { startTime: 5_400, value: 0.1, hadRecentInput: false },
    ]),
    0.6
  );
});

test('preview startup failure returns without waiting for the readiness timeout', async () => {
  const preview = spawn(process.execPath, ['-e', 'process.exit(7)']);
  await once(preview, 'exit');
  await assert.rejects(
    waitUntilReady(preview, () => undefined),
    /Cloudflare preview exited early with status 7/
  );
});

test('local readiness uses the hostname required by the adapter streaming workaround', async () => {
  const preview = spawn(
    process.execPath,
    ['-e', 'setInterval(() => {}, 1000)'],
    {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    }
  );
  await once(preview, 'spawn');
  const originalFetch = globalThis.fetch;
  let requested = '';
  globalThis.fetch = async (input) => {
    requested = String(input);
    return new Response('<main>Ready</main>');
  };
  try {
    await waitUntilReady(preview, () => undefined);
    assert.equal(requested, 'http://localhost:8787');
  } finally {
    globalThis.fetch = originalFetch;
    await stopPreview(preview);
  }
});

test('preview cleanup stops the child process', async () => {
  const preview = spawn(
    process.execPath,
    ['-e', 'setInterval(() => {}, 1000)'],
    {
      detached: process.platform !== 'win32',
      stdio: 'ignore',
    }
  );
  await once(preview, 'spawn');
  await stopPreview(preview);
  assert.ok(preview.exitCode !== null || preview.signalCode !== null);
});

test('managed preview rejects an occupied port rather than accepting an unrelated server', async () => {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  try {
    await assert.rejects(
      assertPreviewPortAvailable(`http://localhost:${address.port}`),
      /already in use|occupied/i
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
  await assertPreviewPortAvailable(`http://localhost:${address.port}`);
});

for (const exitEarly of [false, true]) {
  test(
    `preview cleanup stops a signal-resistant descendant after wrapper ${exitEarly ? 'already exited' : 'exits during cleanup'}`,
    { skip: process.platform === 'win32' },
    async () => {
      const childCode = `const net=require('node:net');process.on('SIGTERM',()=>{});const server=net.createServer();server.listen(0,'127.0.0.1',()=>process.stdout.write(String(server.address().port)+'\\n'));`;
      const wrapperCode = `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',${JSON.stringify(childCode)}],{stdio:['ignore','pipe','ignore']});child.stdout.once('data',data=>{process.stdout.write(data,()=>{${exitEarly ? 'process.exit(0)' : ''}})});`;
      const preview = spawn(process.execPath, ['-e', wrapperCode], {
        detached: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const [chunk] = await once(preview.stdout, 'data');
      const url = `http://localhost:${Number(String(chunk).trim())}`;
      try {
        if (exitEarly) await once(preview, 'exit');
        await assert.rejects(assertPreviewPortAvailable(url));
        await stopPreview(preview);
        await delay(50);
        await assertPreviewPortAvailable(url);
      } finally {
        if (preview.pid !== undefined) {
          try {
            process.kill(-preview.pid, 'SIGKILL');
          } catch (error) {
            assert.equal((error as NodeJS.ErrnoException).code, 'ESRCH');
          }
        }
      }
    }
  );
}

test('readiness does not accept HTTP success without this preview runtime readiness signal', async () => {
  const preview = spawn(
    process.execPath,
    ['-e', 'setTimeout(()=>process.exit(7),100)'],
    { detached: process.platform !== 'win32', stdio: 'ignore' }
  );
  await once(preview, 'spawn');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<main>Unrelated server</main>');
  try {
    await assert.rejects(
      waitUntilReady(
        preview,
        () => undefined,
        () => false
      ),
      /exited early with status 7/
    );
  } finally {
    globalThis.fetch = originalFetch;
    await stopPreview(preview);
  }
});

test('a managed preview that exits during collection invalidates the measurement', async () => {
  const preview = spawn(
    process.execPath,
    ['-e', 'setTimeout(()=>process.exit(7),100)'],
    { detached: process.platform !== 'win32', stdio: 'ignore' }
  );
  await once(preview, 'spawn');
  try {
    await assert.rejects(
      monitorPreview(
        preview,
        () => undefined,
        async () => {
          await delay(500);
          return 'must not succeed';
        }
      ),
      /exited early with status 7/
    );
  } finally {
    await stopPreview(preview);
  }
});

test('a managed preview bind failure invalidates collection even while its wrapper remains alive', async () => {
  const preview = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    detached: process.platform !== 'win32',
    stdio: 'ignore',
  });
  await once(preview, 'spawn');
  let error: Error | undefined;
  const timer = setTimeout(() => {
    error = new Error('Managed preview failed to bind.');
  }, 50);
  try {
    await assert.rejects(
      monitorPreview(
        preview,
        () => error,
        async () => {
          await delay(500);
          return 'must not succeed';
        }
      ),
      /failed to bind/
    );
  } finally {
    clearTimeout(timer);
    await stopPreview(preview);
  }
});

test('runtime failure invalidates a current report while preserving its actual measured bytes and counts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'metrics-runtime-failure-'));
  const path = join(root, 'artifacts/cloudflare-preview-metrics.json');
  await mkdir(join(root, 'artifacts'));
  const startedAt = Date.now() - 100;
  const partial = {
    status: 'valid',
    routes: {
      '/': { counts: { valid: 1 }, transfers: { cold: [{ bytes: 875 }] } },
    },
  };
  try {
    await writeFile(path, JSON.stringify(partial));
    await recordPreviewFailure(
      root,
      startedAt,
      new Error('Managed preview exited early.')
    );
    const failed = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(failed.status, 'failed');
    assert.match(failed.reason, /exited early/);
    assert.deepEqual(failed.routes, partial.routes);
    await writeFile(path, JSON.stringify(partial));
    await utimes(path, new Date(0), new Date(0));
    await recordPreviewFailure(
      root,
      startedAt,
      new Error('Managed preview port is occupied.')
    );
    const startupFailure = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(startupFailure.status, 'failed');
    assert.deepEqual(
      startupFailure.routes,
      {},
      'a previous run must not become this failed run’s measurements'
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a gated collection write cannot restore valid JSON after runtime failure is stamped', async () => {
  const root = await mkdtemp(join(tmpdir(), 'metrics-write-race-'));
  const path = join(root, 'artifacts/cloudflare-preview-metrics.json');
  await mkdir(join(root, 'artifacts'));
  await writeFile(
    path,
    JSON.stringify({ status: 'valid', routes: { '/': { bytes: 875 } } })
  );
  const preview = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    detached: process.platform !== 'win32',
    stdio: 'ignore',
  });
  await once(preview, 'spawn');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let enter!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  let error: Error | undefined;
  let pendingWrite: Promise<void> = Promise.resolve();
  try {
    const monitored = monitorPreview(
      preview,
      () => error,
      (signal) => {
        pendingWrite = writePreviewReport(
          path,
          { status: 'valid', routes: { '/': { bytes: 999 } } },
          signal,
          async (output, contents) => {
            enter();
            await gate;
            await writeFile(output, contents);
          }
        );
        return pendingWrite;
      }
    );
    await entered;
    error = new Error('Managed preview exited during report write.');
    await assert.rejects(monitored, /exited during report write/);
    await recordPreviewFailure(root, 0, error);
    release();
    await assert.rejects(pendingWrite, /exited during report write/);
    const saved = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(saved.status, 'failed');
    assert.equal(saved.routes['/'].bytes, 875);
  } finally {
    release();
    await stopPreview(preview);
    await rm(root, { recursive: true, force: true });
  }
});

test('readiness cancels its unused response stream before accepting the owned runtime', async () => {
  const preview = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    detached: process.platform !== 'win32',
    stdio: 'ignore',
  });
  await once(preview, 'spawn');
  const originalFetch = globalThis.fetch;
  let cancelled = 0;
  globalThis.fetch = async () =>
    new Response(
      new ReadableStream({
        cancel() {
          cancelled++;
        },
      })
    );
  try {
    await waitUntilReady(
      preview,
      () => undefined,
      () => true
    );
    assert.equal(cancelled, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await stopPreview(preview);
  }
});

test('runtime failure detection matches an error split across captured log chunks', () => {
  let output = 'Workers runtime fai';
  assert.equal(previewRuntimeError(output), undefined);
  output += 'led to start';
  assert.match(
    previewRuntimeError(output)?.message ?? '',
    /failed to bind or start/
  );
});
