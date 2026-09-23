import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import {
  discoverWebmentionEndpoint,
  parseLinkHeader,
} from '@/lib/indieweb/send-webmention';

const rocks = 'https://webmention.rocks';

/**
 * Discover the endpoint for a target whose HEAD response carries these Link
 * headers, the way webmention.rocks serves them. A page with no endpoint in
 * its headers falls through to an empty HTML body.
 */
async function discoverFromHeaders(target: string, links: string[]) {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    const headers = new Headers();
    for (const link of links) headers.append('Link', link);
    return new Response('', { headers });
  });
  try {
    return await discoverWebmentionEndpoint(target);
  } finally {
    fetchMock.mock.restore();
  }
}

test('webmention.rocks test 1: a relative URL in an unquoted rel', async () => {
  assert.equal(
    await discoverFromHeaders(`${rocks}/test/1`, [
      '</test/1/webmention?head=true>; rel=webmention',
    ]),
    `${rocks}/test/1/webmention?head=true`
  );
});

test('webmention.rocks test 2: an absolute URL in an unquoted rel', async () => {
  assert.equal(
    await discoverFromHeaders(`${rocks}/test/2`, [
      `<${rocks}/test/2/webmention?head=true>; rel=webmention`,
    ]),
    `${rocks}/test/2/webmention?head=true`
  );
});

test('webmention.rocks test 7: a Link header name in strange casing', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return new Response('', {
      headers: {
        LinK: `<${rocks}/test/7/webmention?head=true>; rel=webmention`,
      },
    });
  });
  try {
    assert.equal(
      await discoverWebmentionEndpoint(`${rocks}/test/7`),
      `${rocks}/test/7/webmention?head=true`
    );
  } finally {
    fetchMock.mock.restore();
  }
});

test('webmention.rocks test 8: a quoted rel', async () => {
  assert.equal(
    await discoverFromHeaders(`${rocks}/test/8`, [
      `<${rocks}/test/8/webmention?head=true>; rel="webmention"`,
    ]),
    `${rocks}/test/8/webmention?head=true`
  );
});

test('webmention.rocks test 10: a rel list in a Link header', async () => {
  assert.equal(
    await discoverFromHeaders(`${rocks}/test/10`, [
      `<${rocks}/test/10/webmention?head=true>; rel="webmention somethingelse"`,
    ]),
    `${rocks}/test/10/webmention?head=true`
  );
});

test('webmention.rocks test 11: the Link header wins over the HTML', async () => {
  assert.equal(
    await discoverFromHeaders(`${rocks}/test/11`, [
      '</test/11/webmention>; rel="webmention"',
    ]),
    `${rocks}/test/11/webmention`
  );
});

test('webmention.rocks test 18: several Link headers', async () => {
  assert.equal(
    await discoverFromHeaders(`${rocks}/test/18`, [
      `<${rocks}/test/18/webmention/error>; rel="other"`,
      `<${rocks}/test/18/webmention?head=true>; rel="webmention"`,
    ]),
    `${rocks}/test/18/webmention?head=true`
  );
});

test('webmention.rocks test 19: one Link header with several values', async () => {
  assert.equal(
    await discoverFromHeaders(`${rocks}/test/19`, [
      `<${rocks}/test/19/webmention/error>; rel="other", <${rocks}/test/19/webmention?head=true>; rel="webmention"`,
    ]),
    `${rocks}/test/19/webmention?head=true`
  );
});

test('webmention is found anywhere in a rel list', () => {
  assert.equal(
    parseLinkHeader(
      '<https://a.example/wm>; rel="other webmention"',
      'webmention'
    ),
    'https://a.example/wm'
  );
  assert.equal(
    parseLinkHeader(
      '<https://a.example/wm>; rel="  me\twebmention  "',
      'webmention'
    ),
    'https://a.example/wm'
  );
});

test('rel values match whole relation types, in any case', () => {
  assert.equal(
    parseLinkHeader('<https://a.example/wm>; rel=WebMention', 'webmention'),
    'https://a.example/wm'
  );
  assert.equal(
    parseLinkHeader(
      '<https://a.example/no>; rel="not-webmention", <https://a.example/wm>; rel=webmention',
      'webmention'
    ),
    'https://a.example/wm'
  );
});

test('commas inside a URL or a quoted value stay with their link', () => {
  assert.equal(
    parseLinkHeader(
      '<https://a.example/wm?tags=a,b;c>; rel="webmention"',
      'webmention'
    ),
    'https://a.example/wm?tags=a,b;c'
  );
  assert.equal(
    parseLinkHeader(
      '<https://a.example/other>; title="a, b; rel=webmention"; rel="other", <https://a.example/wm>; rel="webmention"',
      'webmention'
    ),
    'https://a.example/wm'
  );
});

test('only the first rel parameter on a link counts', () => {
  assert.equal(
    parseLinkHeader(
      '<https://a.example/other>; rel="other"; rel="webmention"',
      'webmention'
    ),
    null
  );
});

test('parameters are read with or without spaces and in any order', () => {
  assert.equal(
    parseLinkHeader(
      '<https://a.example/wm> ; type="text/html" ; REL = "webmention"',
      'webmention'
    ),
    'https://a.example/wm'
  );
});

test('a header with no webmention link finds nothing', () => {
  assert.equal(
    parseLinkHeader('<https://a.example/feed>; rel="alternate"', 'webmention'),
    null
  );
  assert.equal(parseLinkHeader('', 'webmention'), null);
  assert.equal(parseLinkHeader('not a link header', 'webmention'), null);
});

test('a malformed header of quoted values fails without backtracking', () => {
  // Each quoted value used to read two ways, doubling the work per value:
  // 24 of them took over a second before the header was rejected.
  const header = '<x>' + '; a="b;c"'.repeat(24) + ' !';
  const start = performance.now();
  assert.equal(parseLinkHeader(header, 'webmention'), null);
  assert.ok(performance.now() - start < 100);
});
