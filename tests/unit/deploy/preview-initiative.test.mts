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
