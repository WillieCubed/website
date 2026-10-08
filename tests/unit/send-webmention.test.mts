import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';

import {
  discoverWebmentionEndpoint as discoverEndpoint,
  extractExternalLinks,
  sendWebmention as send,
  sendWebmentionsForPost as sendForPost,
  targetsForUpdatedPost,
  webmentionTargetsForWriting,
} from '@/lib/indieweb/send-webmention';
import type { WebmentionSourceWriting } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

const network = {
  resolve: async () => [{ address: '93.184.216.34', family: 4 as const }],
  fetch: (url: string, init: RequestInit) => globalThis.fetch(url, init),
};
const discoverWebmentionEndpoint = (url: string) =>
  discoverEndpoint(url, network);
const sendWebmention = (source: string, target: string) =>
  send(source, target, network);

const sendWebmentionsForPost = (
  writing: WebmentionSourceWriting,
  content: string
) => sendForPost(writing, content, network);

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

test('temporary discovery failures do not report a verified absent endpoint', async () => {
  const calls = serve({ status: 503 });
  const unavailable = await sendWebmention(source, target);
  assert.equal(unavailable.success, false);
  assert.match(unavailable.error!, /discovery.*503/i);
  assert.equal(unavailable.statusCode, undefined);
  assert.ok(calls.every((call) => call.method !== 'POST'));

  mock.method(globalThis, 'fetch', async () => {
    throw new Error('A temporary connection failure');
  });
  mock.method(console, 'error', () => {});
  const disconnected = await sendWebmention(source, target);
  assert.equal(disconnected.success, false);
  assert.match(disconnected.error!, /temporary connection failure/i);
  assert.notEqual(disconnected.error, 'No webmention endpoint found');

  const guarded = await send(source, 'http://127.0.0.1/private', {
    resolve: async () => [{ address: '127.0.0.1', family: 4 }],
    fetch: async () => {
      throw new Error('A blocked target must not be fetched');
    },
  });
  assert.equal(guarded.success, false);
  assert.match(guarded.error!, /discovery.*public document/i);
});

test('only external links are sent webmentions, once each', () => {
  const html = `
    <a href="https://example.com/a">a</a>
    <a href="https://example.com/a">a again</a>
    <a href='https://example.org/b'>b</a>
    <a href="http://example.net/insecure">insecure</a>
    <a href="${site.origin}/writings/other">own page</a>
    <a href="https://tour.willie.page/">own subdomain</a>
    <a href="/relative">relative</a>
    <a href="mailto:hi@example.com">mail</a>
    [Micropub note](https://webmention.rocks/test/1)
    [duplicate](https://example.com/a)
    [own Markdown link](${site.origin}/writings/other)
  `;
  assert.deepEqual(extractExternalLinks(html), [
    'https://example.com/a',
    'https://example.org/b',
    'http://example.net/insecure',
    'https://webmention.rocks/test/1',
  ]);
  assert.deepEqual(extractExternalLinks('<p>No links.</p>'), []);
});

test('bare URLs in a note are sent webmentions without the punctuation around them', () => {
  const note = `
Read https://example.com/a. Then https://example.org/b, and http://example.net/c!
Was it https://example.com/q? (See https://example.com/paren) or
[https://example.com/d](https://example.com/d); “https://example.com/quote”
and https://en.wikipedia.org/wiki/Bloom_(botany): https://example.com/e]
Again https://example.com/a and <https://example.com/angle>.
Not ${site.origin}/writings/other. or http://tour.willie.page/x.
  `;
  assert.deepEqual(extractExternalLinks(note), [
    'https://example.com/a',
    'https://example.org/b',
    'http://example.net/c',
    'https://example.com/q',
    'https://example.com/paren',
    'https://example.com/d',
    'https://example.com/quote',
    'https://en.wikipedia.org/wiki/Bloom_(botany)',
    'https://example.com/e',
    'https://example.com/angle',
  ]);
});

test('URLs inside code are not sent webmentions', () => {
  const post = `
Send it with \`curl https://example.com/inline\` or read https://example.com/prose.

\`\`\`sh
curl -X POST https://example.com/fenced
\`\`\`

~~~~
https://example.com/tilde
~~~~

<pre><code>https://example.com/element</code></pre>

\`\`\`
https://example.com/unclosed
  `;
  assert.deepEqual(extractExternalLinks(post), ['https://example.com/prose']);
});

/** A writing with no interaction targets or person tags unless given. */
function writing(
  overrides: Partial<WebmentionSourceWriting> = {}
): WebmentionSourceWriting {
  return { slug: 'hello', people: [], ...overrides };
}

test('a writing targets its links, then what it answers, then its people', () => {
  const targets = webmentionTargetsForWriting(
    writing({
      inReplyTo: 'https://example.com/posts/parent',
      likeOf: 'https://example.com/posts/liked',
      repostOf: 'https://example.com/posts/reposted',
      bookmarkOf: 'https://example.com/posts/saved',
      rsvp: { eventUrl: 'https://example.com/events/1', status: 'yes' },
      people: [{ name: 'Ada', url: 'https://ada.example/' }],
    }),
    'See [the parent](https://example.com/posts/parent) and https://example.org/b.'
  );
  assert.deepEqual(targets, [
    'https://example.com/posts/parent',
    'https://example.org/b',
    'https://example.com/posts/liked',
    'https://example.com/posts/reposted',
    'https://example.com/posts/saved',
    'https://example.com/events/1',
    'https://ada.example/',
  ]);
});

test('a reply whose body never links its parent still notifies the parent', async () => {
  const calls = serve({ html: '<link rel="webmention" href="/wm">' });
  const results = await sendWebmentionsForPost(
    writing({ inReplyTo: target }),
    'Agreed, and here is why.'
  );
  assert.deepEqual(
    results.map((result) => result.targetUrl),
    [target]
  );
  const [post] = calls.filter((call) => call.method === 'POST');
  assert.equal(post.body?.get('source'), source);
  assert.equal(post.body?.get('target'), target);
});

test('a post sends from its writing URL to each target once', async () => {
  const calls = serve({ html: '<link rel="webmention" href="/wm">' });
  const results = await sendWebmentionsForPost(
    writing({ people: [{ name: 'Example', url: target }] }),
    `<a href="${target}">a post</a>`
  );
  assert.deepEqual(
    results.map((result) => result.targetUrl),
    [target]
  );
  const posts = calls.filter((call) => call.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].body?.get('source'), source);
});

test('updated posts notify former targets after a link is removed', () => {
  assert.deepEqual(
    targetsForUpdatedPost(
      ['https://example.com/new'],
      ['https://example.com/old']
    ),
    ['https://example.com/new', 'https://example.com/old']
  );
});
