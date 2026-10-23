import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import test from 'node:test';

test('an HLS video reads neither its player nor its manifest until playback intent and respects a pause while loading', async () => {
  const directory = await mkdtemp(join(process.cwd(), 'artifacts/hls-intent-'));
  let releaseManifest!: () => void;
  const manifestReady = new Promise<void>((resolve) => {
    releaseManifest = resolve;
  });
  const server = createServer(async (request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname;
    if (path === '/') {
      response.end(
        '<div id="root"></div><script type="module" src="/entry.js"></script>'
      );
    } else if (path.endsWith('.m3u8')) {
      await manifestReady;
      response.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      response.end(
        '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:5\n#EXTINF:5,\nsegment.ts\n#EXT-X-ENDLIST\n'
      );
    } else {
      try {
        response.setHeader(
          'Content-Type',
          path.endsWith('.css') ? 'text/css' : 'text/javascript'
        );
        response.end(await readFile(join(directory, path)));
      } catch {
        response.writeHead(404).end();
      }
    }
  });
  const browser = await chromium.launch({ headless: true });
  try {
    await build({
      stdin: {
        contents: `import React from 'react';import {createRoot} from 'react-dom/client';import Video from './components/media/NativeVideo';createRoot(document.getElementById('root')).render(React.createElement(Video,{src:location.origin+'/stream.m3u8'}));`,
        resolveDir: process.cwd(),
        sourcefile: 'entry.tsx',
      },
      bundle: true,
      splitting: true,
      format: 'esm',
      platform: 'browser',
      outdir: directory,
      entryNames: 'entry',
      chunkNames: '[name]-[hash]',
      jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const address = server.address();
    assert.ok(address !== null && typeof address !== 'string');
    const page = await browser.newPage();
    const requests: string[] = [];
    page.on('pageerror', (error) => console.error(error.message));
    page.on('request', (request) =>
      requests.push(new URL(request.url()).pathname)
    );
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.locator('video').waitFor();
    await page.evaluate(() => new Promise(requestAnimationFrame));
    assert.equal(
      requests.some((path) => /hls.*\.js$|\.m3u8$/.test(path)),
      false
    );
    await page.locator('video').evaluate((video: HTMLVideoElement) => {
      video.dataset.playCalls = '0';
      video.play = () => {
        video.dataset.playCalls = String(Number(video.dataset.playCalls) + 1);
        return Promise.resolve();
      };
    });
    const manifestResponse = page.waitForResponse('**/stream.m3u8');
    const manifest = page.waitForRequest('**/stream.m3u8');
    await page.locator('video').dispatchEvent('play');
    await manifest;
    await page.locator('video').dispatchEvent('pause');
    releaseManifest();
    await (await manifestResponse).finished();
    await page.waitForTimeout(250);
    assert.equal(
      await page.locator('video').getAttribute('data-play-calls'),
      '0'
    );
    const segment = page.waitForRequest('**/segment.ts');
    await page.locator('video').dispatchEvent('play');
    await segment;
    assert.equal(
      requests.some((path) => /hls.*\.js$/.test(path)),
      true
    );
  } finally {
    releaseManifest();
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
