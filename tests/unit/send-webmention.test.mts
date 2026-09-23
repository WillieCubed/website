import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';

import {
  discoverWebmentionEndpoint,
  extractExternalLinks,
  sendWebmention,
  sendWebmentionsForPost,
} from '@/lib/indieweb/send-webmention';
import { site } from '@/lib/site';

const target = 'https://example.com/posts/1';
const source = `${site.origin}/writings/hello`;

interface Page {
  headers?: Record<string, string>;
  html?: string;
  status?: number;
}

interface Call {
  url: string;
  method: string;
  body?: URLSearchParams;
}

/**
 * Serve `page` for the target and answer POSTs with `postStatus`, recording
 * every request.
 */
function serve(page: Page, postStatus = 202) {
  const calls: Call[] = [];
  mock.method(
    globalThis,
    'fetch',
    async (input: string | URL, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      calls.push({
        url: String(input),
        method,
        body: init.body as URLSearchParams | undefined,
      });
      if (method === 'POST') return new Response(null, { status: postStatus });
      return new Response(method === 'HEAD' ? null : (page.html ?? ''), {
        status: page.status ?? 200,
        headers: page.headers,
      });
    }
  );
  return calls;
}

afterEach(() => mock.restoreAll());

test('an endpoint in the Link header is found without fetching the page', async () => {
  const calls = serve({
    headers: {
      Link: '<https://example.com/feed>; rel="alternate", </webmention>; rel="webmention"',
    },
  });
  assert.equal(
    await discoverWebmentionEndpoint(target),
    'https://example.com/webmention'
  );
  assert.deepEqual(
    calls.map((call) => call.method),
    ['HEAD']
  );
});

test('an endpoint in the page is found and resolved against it', async () => {
  const cases = [
    ['<link rel="webmention" href="/wm">', 'https://example.com/wm'],
    ['<link href="wm" rel="webmention">', 'https://example.com/posts/wm'],
    [
      '<a rel="webmention" href="https://hooks.example.net/wm">wm</a>',
      'https://hooks.example.net/wm',
    ],
  ];
  for (const [html, endpoint] of cases) {
    serve({ html: `<html><head>${html}</head></html>` });
    assert.equal(await discoverWebmentionEndpoint(target), endpoint, html);
  }
});

test('a page with no endpoint has none', async () => {
  serve({ html: '<link rel="stylesheet" href="/site.css">' });
  assert.equal(await discoverWebmentionEndpoint(target), null);

  serve({ html: '<link rel="webmention" href="/wm">', status: 404 });
  assert.equal(await discoverWebmentionEndpoint(target), null);
});

test('a target that cannot be reached has no endpoint', async () => {
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('getaddrinfo ENOTFOUND example.com');
  });
  const error = mock.method(console, 'error', () => {});
  assert.equal(await discoverWebmentionEndpoint(target), null);
  assert.equal(error.mock.callCount(), 1);
});

test('a webmention is posted as a form to the discovered endpoint', async () => {
  const calls = serve({ html: '<link rel="webmention" href="/wm">' });
  assert.deepEqual(await sendWebmention(source, target), {
    targetUrl: target,
    success: true,
    endpoint: 'https://example.com/wm',
    statusCode: 202,
  });

  const post = calls.find((call) => call.method === 'POST');
  assert.equal(post?.url, 'https://example.com/wm');
  assert.equal(post?.body?.get('source'), source);
  assert.equal(post?.body?.get('target'), target);
});

test('a webmention the endpoint refuses is reported as failed', async () => {
  serve({ html: '<link rel="webmention" href="/wm">' }, 400);
  const result = await sendWebmention(source, target);
  assert.equal(result.success, false);
  assert.equal(result.statusCode, 400);
});

test('a target with no endpoint is not posted to', async () => {
  const calls = serve({ html: '<p>No endpoint here.</p>' });
  assert.deepEqual(await sendWebmention(source, target), {
    targetUrl: target,
    success: false,
    error: 'No webmention endpoint found',
  });
  assert.ok(calls.every((call) => call.method !== 'POST'));
});

test('only external https links are sent webmentions, once each', () => {
  const html = `
    <a href="https://example.com/a">a</a>
    <a href="https://example.com/a">a again</a>
    <a href='https://example.org/b'>b</a>
    <a href="http://example.net/insecure">insecure</a>
    <a href="${site.origin}/writings/other">own page</a>
    <a href="https://tour.willie.page/">own subdomain</a>
    <a href="/relative">relative</a>
    <a href="mailto:hi@example.com">mail</a>
  `;
  assert.deepEqual(extractExternalLinks(html), [
    'https://example.com/a',
    'https://example.org/b',
  ]);
  assert.deepEqual(extractExternalLinks('<p>No links.</p>'), []);
});

test('a post sends from its writing URL to each target once', async () => {
  const calls = serve({ html: '<link rel="webmention" href="/wm">' });
  const results = await sendWebmentionsForPost(
    'hello',
    `<a href="${target}">a post</a>`,
    [target]
  );
  assert.deepEqual(
    results.map((result) => result.targetUrl),
    [target]
  );
  const posts = calls.filter((call) => call.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].body?.get('source'), source);
});
