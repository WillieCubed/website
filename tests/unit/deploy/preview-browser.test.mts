import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import {
  sampleJourney,
  sampleRoute,
} from '../../../scripts/cloudflare/preview-metrics.mts';
import { installObservers } from '../../../scripts/cloudflare/preview-observers.mts';

const html = `<h1>A visible performance fixture</h1><link rel="stylesheet" href="/style.css"><img src="/image.svg" width="10" height="10" alt=""><a href="/next" hidden>Hidden breadcrumb</a><a href="/next" data-next>Next</a><script src="/app.js"></script><!--${'padding'.repeat(10_000)}-->`;
const compressed = gzipSync(html);
const resources: Partial<Record<string, [string, string]>> = {
  '/style.css': ['text/css', 'h1 { color: green; }'],
  '/image.svg': [
    'image/svg+xml',
    '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="green"/></svg>',
  ],
  '/data.json': ['application/json', '{"ok":true}'],
  '/next.rsc': ['text/x-component', 'route payload'],
  '/prefetch.rsc': ['text/x-component', 'prefetch payload'],
  '/app.js': [
    'text/javascript',
    `fetch('/ignored-error');fetch('/data.json');fetch('/next.rsc');fetch('/prefetch.rsc',{headers:{'Next-Router-Prefetch':'1'}});document.querySelector('a[data-next]').onclick=async(event)=>{event.preventDefault();await fetch('/next.rsc');history.pushState({},'', '/next');document.querySelector('h1').textContent='Next route';};`,
  ],
};

test('Chromium captures real paints, compressed transfer categories, cache revisits and client navigation', async () => {
  const server = createServer((request, response) => {
    const path = request.url ?? '/';
    if (path === '/ignored-error') {
      response.writeHead(503, {
        'content-type': 'application/json',
        'content-encoding': 'gzip',
      });
      response.end(gzipSync('{"error":"unavailable"}'));
      return;
    }
    if (path === '/broken') {
      response.writeHead(503).end('unavailable');
      return;
    }
    if (path === '/blank') {
      response
        .writeHead(200, { 'content-type': 'text/html' })
        .end('<html><body></body></html>');
      return;
    }
    const resource = resources[path];
    if (resource) {
      response
        .writeHead(200, {
          'content-type': resource[0],
          'cache-control': 'public, max-age=3600',
        })
        .end(resource[1]);
      return;
    }
    response
      .writeHead(200, {
        'content-type': 'text/html',
        'content-encoding': 'gzip',
        'content-length': compressed.byteLength,
      })
      .end(compressed);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  const options = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    sampleCount: 1,
    quietMs: 150,
    timeoutMs: 3000,
  };
  try {
    const result = await sampleRoute(browser, '/', options);
    assert.equal(result.status, 'valid');
    assert.equal(result.counts.valid, 1);
    assert.ok(result.fcpMs! > 0);
    assert.ok(result.lcpMs! > 0);
    assert.equal(result.warm.status, 'valid');
    const cold = result.transfers.cold[0] as {
      bytes: number;
      byCategory: Record<string, number>;
      prefetch: { bytes: number };
      pending: number;
      failed: { status?: number }[];
    };
    const warm = result.transfers.warm[0] as typeof cold;
    assert.ok(
      cold.byCategory.html! < 2000,
      'HTML transfers must use gzip wire bytes, not decoded response size'
    );
    for (const category of ['html', 'rsc', 'js', 'css', 'images', 'json'])
      assert.ok(
        cold.byCategory[category]! > 0,
        `${category} transfer was not recorded`
      );
    const nativePage = await browser.newPage();
    await installObservers(nativePage);
    await nativePage.goto(options.baseUrl);
    assert.equal(
      await nativePage.evaluate(() =>
        window.fetch.toString().includes('[native code]')
      ),
      true
    );
    await nativePage.close();
    assert.equal(
      cold.failed.some((request) => request.status === 503),
      true
    );
    assert.ok(cold.prefetch.bytes > 0);
    assert.equal(
      warm.byCategory.js,
      0,
      'a cached JavaScript asset transfers zero bytes on a warm revisit'
    );
    assert.ok(warm.bytes < cold.bytes);
    const journey = await sampleJourney(
      browser,
      { name: 'fixture', paths: ['/', '/next'] },
      options
    );
    assert.equal(journey.status, 'valid');
    const navigationStep = journey.steps[1];
    assert.ok(navigationStep !== undefined && 'navigation' in navigationStep);
    assert.equal(navigationStep.navigation, 'client');
    const blank = await sampleRoute(browser, '/blank', {
      ...options,
      timeoutMs: 500,
    });
    assert.equal(blank.status, 'failed');
    assert.match(blank.samples[0]?.reason ?? '', /FCP.*LCP/);
    const broken = await sampleRoute(browser, '/broken', options);
    assert.equal(broken.status, 'failed');
    assert.match(broken.samples[0]?.reason ?? '', /503/);
    assert.equal(
      browser.contexts().length,
      0,
      'failed samples must close their browser context'
    );
  } finally {
    await browser.close();
    server.close();
    await once(server, 'close');
  }
});
