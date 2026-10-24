import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';

import {
  sampleJourney,
  sampleRoute,
} from '../../../scripts/cloudflare/preview-metrics.mts';
import { installObservers } from '../../../scripts/cloudflare/preview-observers.mts';
import { capturePreviewScreenshots } from '../../../scripts/cloudflare/preview-screenshots.mts';

const html = `<main><h1>A visible performance fixture</h1><link rel="stylesheet" href="/style.css"><img src="/image.svg" width="10" height="10" alt=""><a href="/next" hidden>Hidden breadcrumb</a><a href="/next" data-next>Next</a><script src="/app.js"></script><!--${'padding'.repeat(10_000)}--></main>`;
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

test('private headers stay on their origin across resources and redirects without disabling warm image caching', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'private-header-isolation-'));
  const leaked: string[] = [];
  let immutableRequests = 0;
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="green"/></svg>';
  const external = createServer((request, response) => {
    if (
      request.headers['x-owner'] !== undefined ||
      request.headers.authorization !== undefined ||
      request.headers.cookie !== undefined
    )
      leaked.push(request.url ?? '/');
    response
      .writeHead(200, {
        'content-type': request.url?.endsWith('.css')
          ? 'text/css'
          : 'image/svg+xml',
        'cache-control': 'public, max-age=31536000, immutable',
      })
      .end(request.url?.endsWith('.css') ? 'h1 { color: green }' : svg);
  });
  external.listen(0, '127.0.0.1');
  await once(external, 'listening');
  const externalAddress = external.address();
  assert.ok(externalAddress !== null && typeof externalAddress !== 'string');
  const externalOrigin = `http://localhost:${externalAddress.port}`;
  const target = createServer((request, response) => {
    if (
      request.headers['x-owner'] !== 'private-owner' ||
      request.headers.authorization !== 'Bearer private-token' ||
      request.headers.cookie?.includes('fixture-session=private-cookie') !==
        true
    ) {
      response.writeHead(401).end('Authentication required');
      return;
    }
    if (request.url === '/immutable.svg') {
      immutableRequests++;
      response
        .writeHead(200, {
          'content-type': 'image/svg+xml',
          'cache-control': 'public, max-age=31536000, immutable',
        })
        .end(svg);
    } else if (request.url === '/redirect.css') {
      response
        .writeHead(302, {
          location: `${externalOrigin}/redirected.css`,
          'cache-control': 'no-store',
        })
        .end();
    } else {
      response
        .writeHead(200, { 'content-type': 'text/html' })
        .end(
          `<main><h1>Private fixture</h1><img src="/immutable.svg" width="100" height="100" alt="Local"><img src="${externalOrigin}/direct.svg" width="100" height="100" alt="External"><link rel="stylesheet" href="/redirect.css"><a href="/next">Next</a></main>`
        );
    }
  });
  target.listen(0, '127.0.0.1');
  await once(target, 'listening');
  const targetAddress = target.address();
  assert.ok(targetAddress !== null && typeof targetAddress !== 'string');
  const options = {
    baseUrl: `http://127.0.0.1:${targetAddress.port}`,
    sampleCount: 1,
    quietMs: 100,
    timeoutMs: 5_000,
    contextOptions: {
      extraHTTPHeaders: {
        'X-Owner': 'private-owner',
        Authorization: 'Bearer private-token',
      },
      storageState: {
        cookies: [
          {
            name: 'fixture-session',
            value: 'private-cookie',
            domain: '127.0.0.1',
            path: '/',
            expires: -1,
            httpOnly: true,
            secure: false,
            sameSite: 'Lax' as const,
          },
        ],
        origins: [],
      },
    },
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const route = await sampleRoute(browser, '/private', options);
    assert.equal(route.status, 'valid');
    assert.equal(route.warm.status, 'valid');
    assert.equal(
      immutableRequests,
      1,
      'an immutable same-origin image must survive the authenticated warm revisit'
    );
    assert.ok(route.transfers.cold[0]!.byCategory.images > 0);
    assert.equal(route.transfers.warm[0]!.byCategory.images, 0);
    assert.deepEqual(
      leaked,
      [],
      'private route measurements must not authorize third-party resources or redirect destinations'
    );
    const journey = await sampleJourney(
      browser,
      { name: 'private', paths: ['/private', '/next'] },
      options
    );
    assert.equal(journey.status, 'valid');
    assert.deepEqual(
      leaked,
      [],
      'private journeys must keep authentication on the selected origin'
    );
    const screenshots = await capturePreviewScreenshots(browser, {
      baseUrl: options.baseUrl,
      routes: ['/private'],
      contextOptions: options.contextOptions,
      outputDirectory: directory,
      settleMs: 0,
    });
    assert.equal(screenshots.status, 'valid');
    assert.deepEqual(
      leaked,
      [],
      'private screenshots must not authorize third-party images or redirected styles'
    );
    assert.equal(browser.contexts().length, 0);
  } finally {
    await browser.close();
    target.close();
    external.close();
    await Promise.all([once(target, 'close'), once(external, 'close')]);
    await rm(directory, { recursive: true, force: true });
  }
});

test('client navigation requires the destination heading and main content while retaining failed transfer bytes', async () => {
  let mode = 'stale';
  const server = createServer((request, response) => {
    if (request.url === '/route.rsc') {
      response
        .writeHead(200, { 'content-type': 'text/x-component' })
        .end('received route payload for ' + mode);
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html' }).end(
      `<main><h1>Projects</h1><a href="/music">Music</a></main><script>
      document.querySelector('a').onclick=async(event)=>{
        event.preventDefault();
        await (await fetch('/route.rsc')).text();
        history.pushState({},'', '/music');
        const mode=${JSON.stringify(mode)};
        if(mode==='blank') document.querySelector('main').replaceChildren();
        if(mode==='error') document.querySelector('main').innerHTML='<h1>Application error</h1><p>Route failed.</p>';
        if(mode==='heading-only') document.body.innerHTML='<aside><h1>Music</h1></aside><main></main>';
        if(mode==='correct') document.querySelector('main').innerHTML='<h1>Music</h1><p>Published playlists.</p>';
        if(mode==='delayed') setTimeout(()=>{document.querySelector('main').innerHTML='<h1>Music</h1><p>Published playlists.</p>';},120);
      };
      </script>`
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  const options = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    quietMs: 50,
    timeoutMs: 1_500,
  };
  try {
    for (mode of [
      'stale',
      'blank',
      'error',
      'heading-only',
      'delayed',
      'correct',
    ]) {
      const result = await sampleJourney(
        browser,
        { name: 'destination-fixture', paths: ['/projects', '/music'] },
        options
      );
      const step = result.steps[1];
      const succeeds = mode === 'delayed' || mode === 'correct';
      assert.equal(
        result.status,
        succeeds ? 'valid' : 'failed',
        `${mode} content must determine navigation success`
      );
      assert.ok(
        'navigation' in step,
        `${mode} must retain the attempted destination step`
      );
      assert.equal(step.status, succeeds ? 'valid' : 'failed');
      assert.equal(step.path, '/music');
      assert.equal(step.navigation, 'client');
      assert.ok(
        step.transfer.bytes > 0,
        'failure must preserve received bytes rather than substitute zero'
      );
      assert.ok(step.transfer.byCategory.rsc > 0);
      assert.equal(step.transfer.settlement.status, 'quiet');
      if (!succeeds) assert.match(result.reason ?? '', /Music|main/i);
    }
    assert.equal(browser.contexts().length, 0);
  } finally {
    await browser.close();
    server.close();
    await once(server, 'close');
  }
});
