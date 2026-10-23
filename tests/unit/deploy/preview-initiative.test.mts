import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';

import {
  collectPreviewMetrics,
  resolveInitiativeTarget,
} from '../../../scripts/cloudflare/preview-metrics.mts';

test('initiative discovery records absent published details without failing measured public routes', async () => {
  let published = false;
  const server = createServer((request, response) => {
    const detail =
      published && request.url === '/initiatives'
        ? '<a href="/initiatives/published">Published initiative</a>'
        : '';
    response
      .writeHead(200, { 'content-type': 'text/html' })
      .end(
        `<main><h1>Fixture ${request.url}</h1><a href="/initiatives/draft" hidden>Draft</a>${detail}</main><nav><a href="/writings" hidden>Hidden breadcrumb</a><a href="/writings">Writings</a><a href="/projects">Projects</a><a href="/music">Music</a></nav>`
      );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  try {
    const absent = await resolveInitiativeTarget(browser, baseUrl);
    assert.equal(absent.status, 'unavailable');
    assert.equal(absent.path, null);
    const report = await collectPreviewMetrics(browser, baseUrl, {
      sampleCount: 1,
      quietMs: 100,
      timeoutMs: 3000,
    });
    assert.equal(report.status, 'partial');
    assert.equal(report.routes['/projects']?.status, 'valid');
    assert.equal(report.routes['/music']?.status, 'valid');
    assert.equal(report.routes['initiative-detail']?.status, 'unavailable');
    assert.deepEqual(report.routes['initiative-detail']?.counts, {
      expected: 1,
      attempted: 0,
      valid: 0,
      failed: 0,
      unavailable: 0,
      missing: 1,
    });
    assert.equal(
      report.journeyCounts['explore-initiatives']?.status,
      'unavailable'
    );
    assert.equal(report.journeyCounts['explore-initiatives']?.attempted, 0);
    assert.equal(report.journeyCounts['browse-projects']?.valid, 1);
    published = true;
    const found = await resolveInitiativeTarget(browser, baseUrl);
    assert.equal(found.path, '/initiatives/published');
    assert.equal(found.status, 'available');
    const configured = await resolveInitiativeTarget(
      browser,
      baseUrl,
      '/initiatives/configured'
    );
    assert.equal(configured.path, '/initiatives/configured');
  } finally {
    await browser.close();
    server.close();
    await once(server, 'close');
  }
});

test('private measurements include an explicitly selected draft with the same auth and sample count', async (t) => {
  const keys = [
    'PREVIEW_METRICS_PRIVATE_ONLY',
    'PREVIEW_METRICS_PRIVATE_BASE_URL',
    'PREVIEW_METRICS_PRIVATE_HEADERS',
    'PREVIEW_METRICS_INITIATIVE_PATH',
  ];
  const previous = keys.map((key) => [key, process.env[key]] as const);
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const paths: string[] = [];
  let breakProbe = false;
  const server = createServer((request, response) => {
    if (breakProbe) {
      request.socket.destroy();
      return;
    }
    if (request.headers['x-owner'] !== 'fixture') {
      response.writeHead(401).end();
      return;
    }
    paths.push(request.url!);
    response
      .writeHead(200, { 'content-type': 'text/html' })
      .end('<h1>Private fixture</h1>');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    Object.assign(process.env, {
      PREVIEW_METRICS_PRIVATE_ONLY: '1',
      PREVIEW_METRICS_PRIVATE_BASE_URL: `http://127.0.0.1:${address.port}`,
      PREVIEW_METRICS_PRIVATE_HEADERS: JSON.stringify({ 'x-owner': 'fixture' }),
      PREVIEW_METRICS_INITIATIVE_PATH: '/initiatives/draft',
    });
    const report = await collectPreviewMetrics(browser, undefined, {
      sampleCount: 1,
      quietMs: 100,
      timeoutMs: 3000,
    });
    assert.equal(report.status, 'valid');
    assert.deepEqual(report.routes, {});
    assert.deepEqual(Object.keys(report.privateRoutes), [
      '/studio',
      '/studio/music',
      '/initiatives/draft',
    ]);
    for (const route of Object.values(report.privateRoutes)) {
      assert.equal(route.counts.valid, 1);
      assert.ok('warm' in route);
      assert.equal(route.warm.counts.valid, 1);
    }
    assert.equal(
      paths.filter((path) => path === '/initiatives/draft').length,
      2
    );
    assert.equal(paths.includes('/initiatives'), false);
    process.env.PREVIEW_METRICS_PRIVATE_HEADERS = '{}';
    const denied = await collectPreviewMetrics(browser, undefined, {
      sampleCount: 1,
    });
    assert.equal(denied.status, 'failed');
    assert.deepEqual(Object.keys(denied.privateRoutes), [
      '/studio',
      '/studio/music',
      '/initiatives/draft',
    ]);
    for (const route of Object.values(denied.privateRoutes)) {
      assert.equal(route.status, 'unavailable');
      assert.equal(route.counts.expected, 1);
      assert.equal(route.counts.missing, 1);
      assert.equal(route.counts.attempted, 0);
    }
    breakProbe = true;
    process.env.PREVIEW_METRICS_PRIVATE_HEADERS = JSON.stringify({
      'x-owner': 'probe-secret-must-not-enter-artifacts',
    });
    const unreachable = await collectPreviewMetrics(browser, undefined, {
      sampleCount: 1,
    });
    assert.equal(unreachable.status, 'failed');
    assert.equal(JSON.stringify(unreachable).includes('probe-secret'), false);
    assert.equal(JSON.stringify(unreachable).includes('x-owner'), false);
    const studioResult = unreachable.privateRoutes['/studio'];
    assert.ok('reason' in studioResult);
    assert.match(studioResult.reason, /could not reach/);
    process.env.PREVIEW_METRICS_INITIATIVE_PATH =
      'https://elsewhere.invalid/initiatives/draft';
    await assert.rejects(collectPreviewMetrics(browser), /same-origin/);
  } finally {
    await browser.close();
    server.close();
    await once(server, 'close');
  }
});
