import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type DocumentObservation,
  type MeasurementSample,
  assessDocument,
  summarizeSamples,
} from '../../../scripts/cloudflare/preview-measurement.mts';
import { TransferLedger } from '../../../scripts/cloudflare/preview-transfers.mts';

const observation = (
  overrides: Partial<DocumentObservation> = {}
): DocumentObservation => ({
  ttfbMs: 30,
  fcpMs: 60,
  lcpMs: 100,
  cls: 0,
  supported: { paint: true, lcp: true, cls: true },
  visibility: 'visible',
  hiddenDuringMeasurement: false,
  ...overrides,
});
const valid = (): MeasurementSample => assessDocument(observation());

test('a visible document missing a supported paint metric fails instead of passing as n/a', () => {
  const result = assessDocument(observation({ fcpMs: null, lcpMs: null }));
  assert.equal(result.status, 'failed');
  assert.match(result.reason ?? '', /FCP.*LCP/);
});

test('hidden documents and unsupported paint APIs are explicit unavailable samples', () => {
  assert.equal(
    assessDocument(observation({ hiddenDuringMeasurement: true })).status,
    'unavailable'
  );
  const result = assessDocument(
    observation({
      supported: { paint: false, lcp: false, cls: false },
      fcpMs: null,
      lcpMs: null,
      cls: null,
    })
  );
  assert.equal(result.status, 'unavailable');
  assert.match(result.reason ?? '', /unsupported/);
});

test('sample accounting exposes partial, failed and unavailable runs without averaging away missing samples', () => {
  const result = summarizeSamples(
    [
      valid(),
      assessDocument(observation({ fcpMs: null })),
      assessDocument(observation({ visibility: 'hidden' })),
    ],
    4
  );
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.counts, {
    expected: 4,
    attempted: 3,
    valid: 1,
    failed: 1,
    unavailable: 1,
    missing: 1,
  });
  assert.equal(result.fcpMs, 60);
  assert.deepEqual(result.metricSamples, {
    ttfbMs: 1,
    fcpMs: 1,
    lcpMs: 1,
    cls: 1,
  });
});

test('transfer bytes use completed protocol downloads and separate RSC and prefetch traffic', () => {
  const ledger = new TransferLedger();
  for (const [id, mimeType, bytes, headers] of [
    ['html', 'text/html', 1000, {}],
    ['rsc', 'text/x-component', 200, {}],
    ['js', 'text/javascript', 300, {}],
    ['css', 'text/css', 40, {}],
    ['image', 'image/svg+xml', 50, {}],
    ['json', 'application/json', 60, {}],
    ['prefetch', 'text/x-component', 70, { 'Next-Router-Prefetch': '1' }],
  ] as const) {
    ledger.request(id, `https://example.test/${id}`, headers);
    ledger.response(id, mimeType, 200);
    ledger.finish(id, bytes);
  }
  ledger.request('cached', 'https://example.test/cached.js', {});
  ledger.response('cached', 'text/javascript', 200);
  ledger.finish('cached', 0);
  const transfer = ledger.snapshot();
  assert.equal(transfer.bytes, 1720);
  assert.deepEqual(transfer.byCategory, {
    html: 1000,
    rsc: 200,
    js: 300,
    css: 40,
    images: 50,
    json: 60,
    other: 0,
  });
  assert.equal(transfer.prefetch.bytes, 70);
  assert.equal(transfer.prefetch.byCategory.rsc, 70);
  assert.equal(transfer.requests, 8);
  assert.equal(transfer.completed, 8);
});

test('failed and incomplete requests cannot look like measured zero-byte downloads', () => {
  const ledger = new TransferLedger();
  ledger.request('failed', 'https://example.test/app.js', {});
  ledger.fail('failed', 'net::ERR_CONNECTION_RESET');
  ledger.request('pending', 'https://example.test/image.png', {});
  const transfer = ledger.snapshot();
  assert.equal(transfer.failed.length, 1);
  assert.equal(transfer.pending, 1);
  assert.equal(transfer.completed, 0);
  ledger.reset();
  assert.equal(ledger.snapshot().pending, 1);
});

test('redirects retain every hop instead of replacing downloaded bytes with the final response', () => {
  const ledger = new TransferLedger();
  ledger.request('redirect', 'https://example.test/old', {});
  ledger.response('redirect', 'text/html', 302);
  ledger.finish('redirect', 100);
  ledger.request('redirect', 'https://example.test/new', {});
  ledger.response('redirect', 'text/html', 200);
  ledger.finish('redirect', 200);
  const transfer = ledger.snapshot();
  assert.equal(transfer.bytes, 300);
  assert.equal(transfer.requests, 2);
});

test('a phase waits for delayed transfer completion before its final byte count', async () => {
  const ledger = new TransferLedger();
  ledger.request('slow', 'https://example.test/slow.json', {});
  ledger.response('slow', 'application/json', 200);
  const complete = setTimeout(() => ledger.finish('slow', 321), 10);
  try {
    const transfer = await ledger.drain(1000, 10);
    assert.equal(transfer.pending, 0);
    assert.equal(transfer.bytes, 321);
    ledger.reset();
    assert.equal(ledger.snapshot().requests, 0);
  } finally {
    clearTimeout(complete);
  }
});

test('a transfer deadline retains unfinished requests across phase checkpoints', async () => {
  const ledger = new TransferLedger();
  ledger.request('stalled', 'https://example.test/stalled.json', {});
  const transfer = await ledger.drain(5);
  assert.equal(transfer.pending, 1);
  assert.equal(transfer.completed, 0);
  ledger.reset();
  assert.equal(ledger.snapshot().pending, 1);
});
