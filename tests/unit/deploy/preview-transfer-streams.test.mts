import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { constants, createGzip } from 'node:zlib';

import { TransferLedger } from '../../../scripts/cloudflare/preview-transfers.mts';
import { sampleRoute } from '../../../scripts/cloudflare/preview-visits.mts';

test('an open compressed RSC response counts encoded headers and chunks before completion', () => {
  const ledger = new TransferLedger();
  ledger.request('stream', 'https://example.test/route?_rsc=1', {
    'Next-Router-Prefetch': '1',
  });
  ledger.response('stream', 'text/x-component', 200, 100);
  ledger.data('stream', 30);
  const sample = ledger.snapshot();
  assert.equal(sample.bytes, 130);
  assert.equal(sample.prefetch.bytes, 130);
  assert.equal(sample.pending, 1);
  assert.equal(sample.completed, 0);
});

test('a later terminal total replaces incremental bytes without double counting across checkpoints', () => {
  const ledger = new TransferLedger();
  ledger.request('stream', 'https://example.test/route?_rsc=1', {
    Purpose: 'prefetch',
  });
  ledger.response('stream', 'text/x-component', 200, 100);
  ledger.data('stream', 30);
  assert.equal(ledger.snapshot().bytes, 130);
  ledger.reset();
  assert.equal(ledger.snapshot().bytes, 0);
  assert.equal(ledger.snapshot().pending, 1);
  ledger.data('stream', 20);
  assert.equal(ledger.snapshot().prefetch.bytes, 20);
  ledger.finish('stream', 180);
  const second = ledger.snapshot();
  assert.equal(second.bytes, 50);
  assert.equal(second.prefetch.byCategory.rsc, 50);
  assert.equal(second.inherited, 1);
  assert.equal(second.completed, 1);
  assert.equal(second.pending, 0);
});

test('cached response metadata never becomes downloaded bytes while its terminal event is pending', () => {
  const ledger = new TransferLedger();
  ledger.request('cached', 'https://example.test/app.js', {});
  ledger.cached('cached');
  ledger.response('cached', 'text/javascript', 200, 8000);
  assert.equal(ledger.snapshot().bytes, 0);
  ledger.reset();
  ledger.finish('cached', 0);
  assert.equal(ledger.snapshot().bytes, 0);
});

test('an idle open RSC stream settles with its pending state disclosed', async () => {
  const ledger = new TransferLedger();
  ledger.request('stream', 'https://example.test/route', {});
  ledger.response('stream', 'text/x-component', 200, 100);
  const sample = await ledger.drain(200, 10);
  assert.equal(sample.settlement.status, 'quiet');
  assert.equal(sample.pending, 1);
  assert.equal(sample.pendingRequests[0]?.category, 'rsc');
});

test('an ignored HTTP error response settles without consuming its body', async () => {
  const ledger = new TransferLedger();
  ledger.request('ignored', 'https://example.test/status', {});
  ledger.response('ignored', 'application/json', 503, 200);
  const sample = await ledger.drain(200, 10);
  assert.equal(sample.settlement.status, 'quiet');
  assert.equal(sample.pending, 1);
  assert.equal(sample.failed[0]?.status, 503);
  assert.equal(sample.bytes, 200);
});

test('a continuously active RSC stream times out instead of declaring byte quiet', async () => {
  const ledger = new TransferLedger();
  ledger.request('active', 'https://example.test/route', {});
  ledger.response('active', 'text/x-component', 200, 100);
  const interval = setInterval(() => ledger.data('active', 1), 2);
  try {
    const sample = await ledger.drain(40, 20);
    assert.equal(sample.settlement.status, 'timeout');
    assert.ok(sample.bytes > 100);
  } finally {
    clearInterval(interval);
  }
});

test('an unanswered request times out even when no bytes arrive', async () => {
  const ledger = new TransferLedger();
  ledger.request('unanswered', 'https://example.test/route', {});
  const sample = await ledger.drain(30, 5);
  assert.equal(sample.settlement.status, 'timeout');
  assert.equal(sample.unanswered, 1);
});

test('phase checkpoints preserve immutable prior snapshots when later bytes arrive', () => {
  const ledger = new TransferLedger();
  ledger.request('error', 'https://example.test/status', {
    'Next-Router-Prefetch': '1',
  });
  ledger.response('error', 'application/json', 503, 200);
  const first = ledger.snapshot();
  ledger.reset();
  ledger.data('error', 30);
  ledger.finish('error', 250);
  assert.equal(first.failed[0]?.bytes, 200);
  assert.equal(first.pendingRequests[0]?.bytes, 200);
  assert.equal(ledger.snapshot().prefetch.bytes, 50);
});

test('Chromium measures an idle partial gzip prefetch stream without waiting for its body to close', async () => {
  const server = createServer((request, response) => {
    if (request.url === '/stream') {
      response.writeHead(200, {
        'content-type': 'text/x-component',
        'content-encoding': 'gzip',
      });
      const gzip = createGzip();
      gzip.pipe(response);
      gzip.write('partial RSC content '.repeat(10_000));
      gzip.flush(constants.Z_SYNC_FLUSH);
      response.on('close', () => gzip.destroy());
      return;
    }
    response
      .writeHead(200, { 'content-type': 'text/html' })
      .end(
        `<main><h1>Willie Chalmers III builds software and systems for people.</h1></main><script>fetch('/stream',{headers:{'Next-Router-Prefetch':'1'}}).then(async response=>{window.heldReader=response.body.getReader();await window.heldReader.read();});</script>`
      );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    const sample = await sampleRoute(browser, '/', {
      baseUrl: `http://127.0.0.1:${address.port}`,
      sampleCount: 1,
      quietMs: 100,
      timeoutMs: 3000,
    });
    assert.equal(sample.status, 'valid');
    assert.equal(sample.warm.status, 'valid');
    const cold = sample.transfers.cold[0]!;
    assert.equal(cold.pending, 1);
    assert.equal(cold.pendingRequests[0]?.category, 'rsc');
    assert.equal(cold.pendingRequests[0]?.prefetch, true);
    assert.ok(cold.prefetch.bytes > 0);
    assert.ok(
      cold.prefetch.bytes < 5000,
      'encoded gzip bytes must not use the 200000-byte decoded body size'
    );
  } finally {
    await browser.close();
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  }
});
