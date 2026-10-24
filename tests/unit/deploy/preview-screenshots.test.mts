import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { capturePreviewScreenshots } from '../../../scripts/cloudflare/preview-screenshots.mts';

test('screenshot evidence contains uncropped desktop and phone viewports in both themes', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'website-metrics-screenshots-')
  );
  let releaseImage!: () => void;
  const imageResponseGate = new Promise<void>((resolve) => {
    releaseImage = resolve;
  });
  const server = createServer((request, response) => {
    if (request.url === '/slow.svg' || request.url === '/pending.svg') {
      const ready =
        request.url === '/pending.svg'
          ? imageResponseGate
          : new Promise<void>((resolve) => setTimeout(resolve, 200));
      void ready.then(() => {
        response
          .writeHead(200, { 'content-type': 'image/svg+xml' })
          .end(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>'
          );
      });
      return;
    }
    if (request.url?.startsWith('/_next/image?')) {
      response.writeHead(404).end();
      return;
    }
    const image =
      request.url === '/bad-images'
        ? '<img src="/_next/image?url=%2Fmissing.svg&amp;w=640&amp;q=75" width="100" height="100" alt="Missing local image">'
        : request.url === '/slow-images'
          ? '<img src="/slow.svg" loading="lazy" width="100" height="100" alt="Delayed local image">'
          : request.url === '/pending-images'
            ? '<img src="/pending.svg" loading="lazy" width="100" height="100" alt="Pending local image">'
            : '';
    response
      .writeHead(200, { 'content-type': 'text/html' })
      .end(
        `<style>body{min-height:2000px;background:white} @media(prefers-color-scheme:dark){body{background:black;color:white}}</style><main><h1>Willie Chalmers III builds software and systems for people.</h1>${image}</main>`
      );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    const manifest = await capturePreviewScreenshots(browser, {
      baseUrl: `http://127.0.0.1:${address.port}`,
      routes: ['/'],
      outputDirectory: directory,
      settleMs: 0,
    });
    assert.equal(manifest.status, 'valid', JSON.stringify(manifest.captures));
    assert.equal(manifest.captures.length, 4);
    assert.deepEqual(
      manifest.captures.map((capture) => [
        capture.viewport.width,
        capture.viewport.height,
        capture.theme,
      ]),
      [
        [1440, 1000, 'light'],
        [1440, 1000, 'dark'],
        [390, 844, 'light'],
        [390, 844, 'dark'],
      ]
    );
    for (const capture of manifest.captures) {
      assert.equal(capture.status, 'valid');
      const png = await readFile(join(directory, capture.file!));
      assert.equal(png.readUInt32BE(16), capture.viewport.width);
      assert.equal(
        png.readUInt32BE(20),
        capture.viewport.height,
        'a 2000px-tall document must still produce a viewport-height screenshot'
      );
    }
    const saved = JSON.parse(
      await readFile(join(directory, 'manifest.json'), 'utf8')
    );
    assert.equal(saved.captures.length, 4);
    assert.equal(browser.contexts().length, 0);
    const broken = await capturePreviewScreenshots(browser, {
      baseUrl: `http://127.0.0.1:${address.port}`,
      routes: ['/bad-images'],
      outputDirectory: join(directory, 'broken'),
      settleMs: 0,
    });
    assert.equal(broken.status, 'failed');
    assert.match(broken.captures[0]?.reason ?? '', /local image/i);
    assert.match(
      broken.captures[0]?.reason ?? '',
      /\/_next\/image\?url=%2Fmissing\.svg&w=640&q=75/,
      'optimized image failures must identify the source and transform'
    );
    const pending = await capturePreviewScreenshots(browser, {
      baseUrl: `http://127.0.0.1:${address.port}`,
      routes: ['/pending-images'],
      outputDirectory: join(directory, 'pending'),
      settleMs: 0,
      imageDecodeTimeoutMs: 20,
    });
    assert.equal(pending.status, 'failed');
    assert.equal(pending.captures.length, 4);
    for (const capture of pending.captures) {
      assert.equal(capture.status, 'failed');
      assert.match(capture.reason ?? '', /within 20ms/);
      assert.match(capture.reason ?? '', /pending\.svg/);
    }
    const settled = await capturePreviewScreenshots(browser, {
      baseUrl: `http://127.0.0.1:${address.port}`,
      routes: ['/slow-images'],
      outputDirectory: join(directory, 'settled'),
      settleMs: 0,
      imageDecodeTimeoutMs: 2_000,
    });
    assert.equal(settled.status, 'valid', JSON.stringify(settled.captures));
  } finally {
    releaseImage();
    await browser.close();
    server.close();
    await once(server, 'close');
    await rm(directory, { recursive: true, force: true });
  }
});

test('private screenshot contexts authenticate without changing variants or exposing credentials', async (t) => {
  const directory = await mkdtemp(
    join(tmpdir(), 'website-private-screenshots-')
  );
  const authorized: string[] = [];
  let publicCredentialLeaks = 0;
  const headerValue = 'fixture-header-secret';
  const cookieValue = 'fixture-cookie-secret';
  const server = createServer((request, response) => {
    const authenticated =
      request.headers['x-fixture-owner'] === headerValue &&
      request.headers.cookie?.includes(`fixture-session=${cookieValue}`);
    if (request.url === '/studio' || request.url === '/studio/music') {
      if (!authenticated) {
        response.writeHead(401).end('Authentication required.');
        return;
      }
      authorized.push(request.url);
    } else if (request.url === '/public') {
      if (
        request.headers['x-fixture-owner'] !== undefined ||
        request.headers.cookie !== undefined
      )
        publicCredentialLeaks++;
    } else {
      response.writeHead(404).end();
      return;
    }
    response
      .writeHead(200, { 'content-type': 'text/html' })
      .end('<main><h1>Fixture content</h1></main>');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const storageState = {
    cookies: [
      {
        name: 'fixture-session',
        value: cookieValue,
        domain: '127.0.0.1',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: false,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const denied = await capturePreviewScreenshots(browser, {
      baseUrl,
      routes: ['/studio'],
      outputDirectory: join(directory, 'denied'),
      settleMs: 0,
    });
    assert.equal(denied.status, 'failed');
    const report = await capturePreviewScreenshots(browser, {
      baseUrl,
      routes: ['/studio', '/studio/music'],
      outputDirectory: join(directory, 'authenticated'),
      settleMs: 0,
      contextOptions: {
        extraHTTPHeaders: { 'x-fixture-owner': headerValue },
        storageState,
      },
    });
    assert.equal(report.status, 'valid');
    assert.equal(authorized.length, 8);
    assert.deepEqual(
      report.captures.map(({ path, viewport, theme }) => [
        path,
        viewport.width,
        viewport.height,
        theme,
      ]),
      [
        ['/studio', 1440, 1000, 'light'],
        ['/studio/music', 1440, 1000, 'light'],
        ['/studio', 1440, 1000, 'dark'],
        ['/studio/music', 1440, 1000, 'dark'],
        ['/studio', 390, 844, 'light'],
        ['/studio/music', 390, 844, 'light'],
        ['/studio', 390, 844, 'dark'],
        ['/studio/music', 390, 844, 'dark'],
      ]
    );
    for (const capture of report.captures) {
      const png = await readFile(
        join(directory, 'authenticated', capture.file!)
      );
      assert.equal(png.readUInt32BE(16), capture.viewport.width);
      assert.equal(png.readUInt32BE(20), capture.viewport.height);
    }
    const { captureOptionalScreenshots } =
      await import('../../../scripts/cloudflare/preview-metrics.mts');
    assert.equal(typeof captureOptionalScreenshots, 'function');
    const environment = [
      'PREVIEW_METRICS_SCREENSHOTS',
      'PREVIEW_METRICS_PRIVATE_ONLY',
      'PREVIEW_METRICS_PRIVATE_BASE_URL',
      'PREVIEW_METRICS_PRIVATE_HEADERS',
      'PREVIEW_METRICS_PRIVATE_STORAGE_STATE',
    ];
    const previous = environment.map((key) => [key, process.env[key]] as const);
    t.after(() => {
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });
    const statePath = join(directory, 'authentication.json');
    await writeFile(statePath, JSON.stringify(storageState));
    Object.assign(process.env, {
      PREVIEW_METRICS_SCREENSHOTS: '1',
      PREVIEW_METRICS_PRIVATE_ONLY: '1',
      PREVIEW_METRICS_PRIVATE_BASE_URL: baseUrl,
      PREVIEW_METRICS_PRIVATE_HEADERS: JSON.stringify({
        'x-fixture-owner': headerValue,
      }),
      PREVIEW_METRICS_PRIVATE_STORAGE_STATE: statePath,
    });
    const metrics = {
      scope: 'private',
      status: 'valid',
      routes: {},
      privateRoutes: { '/studio': {}, '/studio/music': {} },
    } as unknown as Parameters<typeof captureOptionalScreenshots>[1];
    const privateReport = await captureOptionalScreenshots(
      browser,
      metrics,
      join(directory, 'collector'),
      'http://invalid-public-target.example'
    );
    assert.ok('screenshots' in privateReport);
    assert.equal(privateReport.screenshots.status, 'valid');
    assert.equal(privateReport.screenshots.captured, 8);
    const manifest = await readFile(
      join(
        directory,
        'collector/artifacts/cloudflare-preview-screenshots/manifest.json'
      ),
      'utf8'
    );
    for (const secret of [
      headerValue,
      cookieValue,
      'x-fixture-owner',
      'storageState',
      statePath,
    ]) {
      assert.equal(manifest.includes(secret), false);
      assert.equal(JSON.stringify(privateReport).includes(secret), false);
    }
    delete process.env.PREVIEW_METRICS_PRIVATE_ONLY;
    const publicMetrics = {
      ...metrics,
      routes: { '/public': {} },
    } as unknown as typeof metrics;
    const publicReport = await captureOptionalScreenshots(
      browser,
      publicMetrics,
      join(directory, 'public'),
      baseUrl
    );
    assert.ok('screenshots' in publicReport);
    assert.equal(publicReport.screenshots.status, 'valid');
    assert.equal(publicReport.screenshots.captured, 4);
    assert.equal(publicCredentialLeaks, 0);
    assert.equal(browser.contexts().length, 0);
  } finally {
    await browser.close();
    server.close();
    await once(server, 'close');
    await rm(directory, { recursive: true, force: true });
  }
});

test('screenshot evidence rejects blank or hidden main content and retains failed PNGs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'website-blank-screenshots-'));
  const documents: Record<string, string> = {
    '/': '<aside><h1>Willie Chalmers III builds software and systems for people.</h1></aside><main><p>Published projects and work in progress.</p></main>',
    '/search': '<html><body></body></html>',
    '/music': '<nav>Site navigation</nav><main>   </main>',
    '/studio': '<main style="display:none"><h1>Hidden editor</h1></main>',
    '/studio/music':
      '<main style="opacity:0"><h1>Transparent Music editor</h1></main>',
  };
  const server = createServer((request, response) => {
    response
      .writeHead(200, { 'content-type': 'text/html' })
      .end(documents[request.url ?? '/']);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  const browser = await chromium.launch({ headless: true });
  try {
    const report = await capturePreviewScreenshots(browser, {
      baseUrl: `http://127.0.0.1:${address.port}`,
      routes: Object.keys(documents),
      outputDirectory: directory,
      settleMs: 0,
    });
    assert.equal(
      report.status,
      'failed',
      'HTTP 200 and a saved PNG do not prove the page rendered'
    );
    assert.equal(
      report.captured,
      20,
      'failed captures must remain available for diagnosis'
    );
    for (const capture of report.captures) {
      assert.ok(capture.file);
      assert.ok((await readFile(join(directory, capture.file))).length > 0);
      if (capture.path === '/') {
        assert.equal(
          capture.status,
          'valid',
          'Home does not need an h1 inside main'
        );
      } else {
        assert.equal(capture.status, 'failed');
        assert.match(
          capture.reason ?? '',
          /rendered main content|route heading/i
        );
      }
    }
    const saved = JSON.parse(
      await readFile(join(directory, 'manifest.json'), 'utf8')
    );
    assert.equal(saved.status, 'failed');
    assert.equal(
      saved.captures.filter(
        (capture: { status: string }) => capture.status === 'failed'
      ).length,
      16
    );
  } finally {
    await browser.close();
    server.close();
    await once(server, 'close');
    await rm(directory, { recursive: true, force: true });
  }
});
