import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

import {
  discoverWebmentionEndpoint,
  parseHtmlForWebmentionEndpoint,
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

/**
 * Discover the endpoint for a webmention.rocks test whose page has no Link
 * header, so discovery reads `body`: the markup webmention.rocks serves around
 * its endpoints, wrapped in a page that also carries the site's ordinary links.
 */
async function discoverFromPage(number: number, body: string) {
  const target = `${rocks}/test/${number}`;
  const html = `<!doctype html>
<html>
<head>
  <title>Webmention Rocks!</title>
  <link rel="stylesheet" href="/assets/styles.css">
  ${body}
</head>
<body>
  <a href="${rocks}/test/1" rel="nofollow">Test 1</a>
</body>
</html>`;
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    return new Response(html);
  });
  try {
    return await discoverWebmentionEndpoint(target);
  } finally {
    fetchMock.mock.restore();
  }
}

test('webmention.rocks tests 3 to 6: a <link> or <a>, relative or absolute', async () => {
  assert.equal(
    await discoverFromPage(
      3,
      '<link rel="webmention" href="/test/3/webmention">'
    ),
    `${rocks}/test/3/webmention`
  );
  assert.equal(
    await discoverFromPage(
      4,
      `<link href="${rocks}/test/4/webmention" rel="webmention">`
    ),
    `${rocks}/test/4/webmention`
  );
  assert.equal(
    await discoverFromPage(
      5,
      '<p>This post advertises its <a rel="webmention" href="/test/5/webmention">Webmention endpoint</a>.</p>'
    ),
    `${rocks}/test/5/webmention`
  );
  assert.equal(
    await discoverFromPage(
      6,
      `<p>This post advertises its <a href="${rocks}/test/6/webmention" rel="webmention">Webmention endpoint</a>.</p>`
    ),
    `${rocks}/test/6/webmention`
  );
});

test('webmention.rocks test 9: webmention not first in a rel list', async () => {
  assert.equal(
    await discoverFromPage(
      9,
      `<link rel="webmention somethingelse" href="${rocks}/test/9/webmention">`
    ),
    `${rocks}/test/9/webmention`
  );
  assert.equal(
    await discoverFromPage(
      9,
      `<link rel="somethingelse webmention" href="${rocks}/test/9/webmention">`
    ),
    `${rocks}/test/9/webmention`
  );
});

test('webmention.rocks test 12: a rel that only contains the word', async () => {
  assert.equal(
    await discoverFromPage(
      12,
      `<link rel="not-webmention" href="/test/12/webmention/error">
      <p>There is also a <a href="/test/12/webmention" rel="webmention">correct endpoint</a> defined.</p>`
    ),
    `${rocks}/test/12/webmention`
  );
});

test('webmention.rocks test 13: an endpoint inside an HTML comment', async () => {
  assert.equal(
    await discoverFromPage(
      13,
      `<p>This post contains an HTML comment <!-- <a href="/test/13/webmention/error" rel="webmention"></a> --> that contains a rel=webmention element. There is also a <a href="/test/13/webmention" rel="webmention">correct endpoint</a> defined.</p>`
    ),
    `${rocks}/test/13/webmention`
  );
});

test('webmention.rocks test 14: an endpoint in escaped HTML', async () => {
  assert.equal(
    await discoverFromPage(
      14,
      `<p>This post contains sample code with escaped HTML. <code>&lt;a href="/test/14/webmention/error" rel="webmention"&gt;&lt;/a&gt;</code> There is also a <a href="/test/14/webmention" rel="webmention">correct endpoint</a> defined.</p>`
    ),
    `${rocks}/test/14/webmention`
  );
});

test('webmention.rocks test 15: an empty href is the page itself', async () => {
  assert.equal(
    await discoverFromPage(15, '<link rel="webmention" href="">'),
    `${rocks}/test/15`
  );
});

test('webmention.rocks test 16: an <a> before a <link> wins', async () => {
  assert.equal(
    await discoverFromPage(
      16,
      `<p>This post advertises its Webmention endpoint in an HTML <a href="/test/16/webmention" rel="webmention">&lt;a&gt; tag</a>, followed by a later definition in a &lt;link&gt; tag. <link rel="webmention" href="/test/16/webmention/error"></p>`
    ),
    `${rocks}/test/16/webmention`
  );
});

test('webmention.rocks test 17: a <link> before an <a> wins', async () => {
  assert.equal(
    await discoverFromPage(
      17,
      `<p>This post advertises its Webmention endpoint in an HTML &lt;link&gt; tag <link rel="webmention" href="/test/17/webmention"> followed by a later definition in an <a href="/test/17/webmention/error" rel="webmention">&lt;a&gt; tag</a>.</p>`
    ),
    `${rocks}/test/17/webmention`
  );
});

test('webmention.rocks test 20: a <link> with no href is skipped', async () => {
  assert.equal(
    await discoverFromPage(
      20,
      `<p>This post has a &lt;link&gt; tag <link rel="webmention"> which has no href attribute, and should send the webmention to <a href="/test/20/webmention" rel="webmention">this endpoint</a> instead.</p>`
    ),
    `${rocks}/test/20/webmention`
  );
});

test('webmention.rocks tests 21 and 22: a query string, and a path relative to the page', async () => {
  assert.equal(
    await discoverFromPage(
      21,
      '<link rel="webmention" href="/test/21/webmention?query=yes">'
    ),
    `${rocks}/test/21/webmention?query=yes`
  );
  assert.equal(
    await discoverFromPage(22, '<link rel="webmention" href="22/webmention">'),
    `${rocks}/test/22/webmention`
  );
});

/**
 * Serve webmention.rocks test 23: the target redirects to a page whose
 * endpoint is relative to the page it redirected to. Every response reports
 * that final URL, the way fetch does after following a redirect.
 */
async function discoverAfterRedirect(headers: Record<string, string>) {
  const final = `${rocks}/test/23/page/ksGubrIxAHlJfuhVnjk6`;
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    const response = new Response(
      '<div class="h-entry"><p><a rel="webmention" href="webmention-endpoint/ksGubrIxAHlJfuhVnjk6">webmention endpoint</a></p></div>',
      { headers }
    );
    Object.defineProperty(response, 'url', { value: final });
    return response;
  });
  try {
    return await discoverWebmentionEndpoint(`${rocks}/test/23/page`);
  } finally {
    fetchMock.mock.restore();
  }
}

test('webmention.rocks test 23: a relative endpoint resolves against the page reached after a redirect', async () => {
  const endpoint = `${rocks}/test/23/page/webmention-endpoint/ksGubrIxAHlJfuhVnjk6`;
  assert.equal(
    await discoverAfterRedirect({
      Link: '<webmention-endpoint/ksGubrIxAHlJfuhVnjk6>; rel=webmention',
    }),
    endpoint
  );
  assert.equal(await discoverAfterRedirect({}), endpoint);
});

test('a Link header on the page counts when the HEAD response had none', async () => {
  const fetchMock = mock.method(
    globalThis,
    'fetch',
    async (_input: string, init: RequestInit = {}) =>
      new Response('<link rel="webmention" href="/from-html">', {
        headers:
          init.method === 'HEAD'
            ? {}
            : { Link: '</from-header>; rel="webmention"' },
      })
  );
  try {
    assert.equal(
      await discoverWebmentionEndpoint(`${rocks}/test/1`),
      `${rocks}/from-header`
    );
  } finally {
    fetchMock.mock.restore();
  }
});

test('rel values in HTML match in any case and across any whitespace', () => {
  const page = 'https://example.com/posts/1';
  assert.equal(
    parseHtmlForWebmentionEndpoint('<link rel="WebMention" href="/wm">', page),
    'https://example.com/wm'
  );
  assert.equal(
    parseHtmlForWebmentionEndpoint(
      '<a rel="me\twebmention\n" href="/wm">wm</a>',
      page
    ),
    'https://example.com/wm'
  );
});

test('only a <link> or <a> advertises an endpoint', () => {
  assert.equal(
    parseHtmlForWebmentionEndpoint(
      '<map><area rel="webmention" href="/area"></map><template><link rel="webmention" href="/inert"></template>',
      'https://example.com/posts/1'
    ),
    null
  );
});

test('a <base> element sets the URL an endpoint resolves against', () => {
  assert.equal(
    parseHtmlForWebmentionEndpoint(
      '<base target="_blank"><base href="https://cdn.example.net/site/"><base href="/ignored/"><link rel="webmention" href="wm">',
      'https://example.com/posts/1'
    ),
    'https://cdn.example.net/site/wm'
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
