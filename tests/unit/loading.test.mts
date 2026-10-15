import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import SpotifyEmbed from '../../components/mdx/SpotifyEmbed';
import StableImage from '../../components/media/StableImage';
import { fetchWithDeadline } from '../../lib/http/fetch';
import { optionalWithin } from '../../lib/http/optional';
import { sanitizeCommentHtml } from '../../lib/indieweb/comment-content';

test('optional enrichment has a bounded fallback and does not leak late rejections', async () => {
  assert.equal(
    await optionalWithin(new Promise(() => {}), 'baseline', 10),
    'baseline'
  );
  assert.equal(
    await optionalWithin(Promise.reject(new Error('offline')), 'baseline', 10),
    'baseline'
  );
  assert.equal(
    await optionalWithin(Promise.resolve('ready'), 'baseline', 10),
    'ready'
  );
});

test('a request deadline bounds a stalled request and respects caller cancellation', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_input, init) =>
    new Promise((_resolve, reject) => {
      init!.signal!.addEventListener(
        'abort',
        () => reject(init!.signal!.reason),
        { once: true }
      );
    });
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(fetchWithDeadline('https://example.invalid', {}, 10), {
      name: 'TimeoutError',
    });
    const controller = new AbortController();
    const request = fetchWithDeadline(
      'https://example.invalid',
      { signal: controller.signal },
      1000
    );
    controller.abort();
    await assert.rejects(request, { name: 'AbortError' });
  } finally {
    clearTimeout(keepAlive);
    globalThis.fetch = original;
  }
});

test('known image dimensions are truthful and unknown media reserves presentation geometry', () => {
  const unknown = renderToStaticMarkup(
    createElement(StableImage, {
      src: 'https://example.invalid/photo.jpg',
      alt: 'Example',
    })
  );
  assert.match(unknown, /aspect-ratio:4 \/ 3/);
  assert.doesNotMatch(unknown, /width="\d/);
  const known = renderToStaticMarkup(
    createElement(StableImage, {
      src: 'https://example.invalid/photo.jpg',
      alt: 'Example',
      width: 900,
      height: 600,
    })
  );
  assert.match(known, /width="900" height="600"/);
  assert.match(known, /aspect-ratio:900 \/ 600/);
});

test('imported HTML retains valid image metadata and rejects invalid dimensions', () => {
  const valid = sanitizeCommentHtml(
    '<img src="/a.jpg" width="900" height="600">',
    'https://example.invalid'
  );
  assert.match(valid, /width="900" height="600"/);
  const unsafe = sanitizeCommentHtml(
    '<img src="/a.jpg" width="-1" height="999999" style="height:0">',
    'https://example.invalid'
  );
  assert.doesNotMatch(unsafe, /width=|height=|style=/);
});

test('the same deadline bounds the response body after headers arrive', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.write('{');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert(address && typeof address !== 'string');
    const response = await fetchWithDeadline(
      `http://127.0.0.1:${address.port}`,
      {},
      50
    );
    await assert.rejects(
      response.json(),
      (error: unknown) =>
        error instanceof Error &&
        ['AbortError', 'TimeoutError'].includes(error.name)
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('Spotify keeps its actual track destination outside the reserved player', () => {
  const url = 'https://open.spotify.com/track/2HvtedoEeymVWrBPyAMNwZ';
  const html = renderToStaticMarkup(createElement(SpotifyEmbed, { url }));
  assert.match(html, /height="152"/);
  assert.match(
    html,
    /<figcaption><a href="https:\/\/open.spotify.com\/track\/2HvtedoEeymVWrBPyAMNwZ">Open this track on Spotify<\/a><\/figcaption>/
  );
});
