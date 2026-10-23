import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { capturePreviewScreenshots } from '../../../scripts/cloudflare/preview-screenshots.mts';

test('screenshot evidence contains uncropped desktop and phone viewports in both themes', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'website-metrics-screenshots-')
  );
  const server = createServer((request, response) => {
    if (request.url === '/missing.svg') {
      response.writeHead(404).end();
      return;
    }
    const image =
      request.url === '/bad-images'
        ? '<img src="/missing.svg" width="100" height="100" alt="Missing local image">'
        : '';
    response
      .writeHead(200, { 'content-type': 'text/html' })
      .end(
        `<style>body{min-height:2000px;background:white} @media(prefers-color-scheme:dark){body{background:black;color:white}}</style><main><h1>Capture fixture</h1>${image}</main>`
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
  } finally {
    await browser.close();
    server.close();
    await once(server, 'close');
    await rm(directory, { recursive: true, force: true });
  }
});
