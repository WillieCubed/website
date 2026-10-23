import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';

import {
  type BrowserSample,
  calculateCls,
  median,
  medianMetric,
  stopPreview,
  waitUntilReady,
} from '../../../scripts/cloudflare/preview-metrics.mts';

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
