import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INDIEAUTH_DISCOVERY_LINKS,
  buildAtProtocolDid,
  buildHostMetaResponse,
  buildHostMetaXml,
  buildLlmsSummary,
  buildWebFingerResponse,
} from '@/lib/indieweb/discovery';
import { site } from '@/lib/site';

const acct = `acct:${site.author.handle}@${new URL(site.origin).hostname}`;

test('buildWebFingerResponse exposes profile, webmention, and Micropub links', () => {
  const response = buildWebFingerResponse(acct);

  assert.ok(response);
  assert.equal(response.subject, acct);
  assert.ok(response.aliases.includes(site.origin));
  assert.ok(response.links.some((link) => link.rel === 'micropub'));
  assert.ok(
    response.links.some((link) => link.href === `${site.origin}/webmention`)
  );
});

test('WebFinger advertises the same IndieAuth server as the HTML head', () => {
  const response = buildWebFingerResponse(acct);
  assert.ok(response);

  assert.deepEqual(
    INDIEAUTH_DISCOVERY_LINKS.map(({ rel }) => rel),
    ['indieauth-metadata', 'authorization_endpoint', 'token_endpoint']
  );
  for (const { rel, href } of INDIEAUTH_DISCOVERY_LINKS) {
    assert.equal(
      response.links.find((link) => link.rel === rel)?.href,
      `${site.origin}${href}`,
      rel
    );
  }
});

test('the IndieAuth metadata route serves this site as the issuer', async () => {
  const { GET } =
    await import('@/app/.well-known/oauth-authorization-server/route');
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  const metadata = await response.json();
  assert.equal(metadata.issuer, `${site.origin}/`);

  const indieauthMetadata = INDIEAUTH_DISCOVERY_LINKS.find(
    (link) => link.rel === 'indieauth-metadata'
  );
  assert.equal(
    indieauthMetadata?.href,
    '/.well-known/oauth-authorization-server'
  );
  // The issuer must be a prefix of the metadata URL.
  assert.ok(
    `${site.origin}${indieauthMetadata.href}`.startsWith(metadata.issuer)
  );
  for (const { rel, href } of INDIEAUTH_DISCOVERY_LINKS.slice(1)) {
    assert.equal(metadata[rel], `${site.origin}${href}`, rel);
  }
});

const webfinger = async (query: string) => {
  const { GET } = await import('@/app/.well-known/webfinger/route');
  return GET(new Request(`${site.origin}/.well-known/webfinger${query}`));
};

test('WebFinger resolves the author and the home page', async () => {
  for (const resource of [acct, `${site.origin}/`]) {
    const response = await webfinger(
      `?resource=${encodeURIComponent(resource)}`
    );

    assert.equal(response.status, 200, resource);
    assert.match(
      response.headers.get('Content-Type') ?? '',
      /^application\/jrd\+json/
    );
    assert.equal((await response.json()).subject, resource);
  }
});

test('WebFinger answers an unknown resource with a 404', async () => {
  for (const resource of [
    'acct:nobody@example.com',
    `acct:nobody@${new URL(site.origin).hostname}`,
    `${site.origin}/writings`,
    'https://example.com/',
  ]) {
    const response = await webfinger(
      `?resource=${encodeURIComponent(resource)}`
    );

    assert.equal(response.status, 404, resource);
  }
});

test('WebFinger answers a missing resource with a 400', async () => {
  for (const query of ['', '?resource=', '?rel=self']) {
    const response = await webfinger(query);

    assert.equal(response.status, 400, query || '(no query)');
  }
});

test('buildHostMetaResponse points LRDD clients to WebFinger', () => {
  const response = buildHostMetaResponse();

  assert.deepEqual(response.links, [
    {
      rel: 'lrdd',
      template: `${site.origin}/.well-known/webfinger?resource={uri}`,
    },
  ]);
  assert.match(buildHostMetaXml(), /webfinger\?resource=\{uri\}/);
});

test('host-meta.json serves the LRDD link as JSON', async () => {
  const { GET } = await import('@/app/.well-known/host-meta.json/route');
  const response = await GET();

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get('Content-Type') ?? '',
    /^application\/json/
  );
  assert.deepEqual(await response.json(), buildHostMetaResponse());
});

test('buildAtProtocolDid returns the configured DID document pointer', () => {
  assert.equal(buildAtProtocolDid(), `${site.author.atprotoDid}\n`);
});

// llmstxt.org: an H1, an optional blockquote, then lists of `- [name](url)`
// with an optional `: notes` after the link.
const LIST_ITEM = /^- \[[^\]]+\]\(https:\/\/[^)\s]+\)(: .+)?$/;

test('buildLlmsSummary follows the llmstxt.org shape', () => {
  const lines = buildLlmsSummary().split('\n');

  assert.equal(lines[0], `# ${site.name}`);
  assert.ok(
    lines.some((line) => line.startsWith('> ')),
    'a blockquote summary'
  );

  const items = lines.filter((line) => line.startsWith('- '));
  assert.ok(items.length > 0, 'at least one list item');
  for (const item of items) {
    assert.match(item, LIST_ITEM, `not a llmstxt.org list item: ${item}`);
  }
});

test('buildLlmsSummary links the protocol surfaces by name', () => {
  const summary = buildLlmsSummary();
  const surfaces = [
    ['Webmention endpoint', '/webmention'],
    ['Micropub endpoint', '/micropub'],
    ['Webmention activity feed', '/activity/feed.xml'],
    ['Search', '/search?q='],
    ['oEmbed provider', '/oembed?url='],
    ['WebFinger', '/.well-known/webfinger'],
    ['IndieAuth server metadata', '/.well-known/oauth-authorization-server'],
    ['MCP server', '/api/mcp'],
  ];

  for (const [label, path] of surfaces) {
    assert.ok(
      summary.includes(`[${label}](${site.origin}${path})`),
      `${label} should link to ${path}`
    );
  }
});

test('buildLlmsSummary lists each published writing with its description', () => {
  const summary = buildLlmsSummary([
    { slug: 'hello', title: 'Hello', description: 'A first note.' },
  ]);

  assert.match(summary, /^## Writings$/m);
  assert.ok(
    summary.includes(`- [Hello](${site.origin}/writings/hello): A first note.`)
  );
});

test('buildLlmsSummary has no Writings list when nothing is published', () => {
  assert.doesNotMatch(buildLlmsSummary(), /^## Writings$/m);
});

test('buildLlmsSummary leaves out a description that only repeats the title', () => {
  const summary = buildLlmsSummary([
    { slug: 'note', title: 'A short note.', description: 'A short note.' },
  ]);

  assert.ok(
    summary.includes(`- [A short note.](${site.origin}/writings/note)\n`)
  );
});

const listItems = (summary: string) =>
  summary.split('\n').filter((line) => line.startsWith('- '));

test('buildLlmsSummary keeps a multi-line description on its list line', () => {
  const summary = buildLlmsSummary([
    { slug: 'a', title: 'A', description: 'line one\nline two\n' },
  ]);

  assert.ok(
    summary.includes(`- [A](${site.origin}/writings/a): line one line two\n`)
  );
  assert.ok(!summary.split('\n').includes('line two'));
  for (const item of listItems(summary)) assert.match(item, LIST_ITEM);
});

test('buildLlmsSummary percent-encodes a slug so the link stays one token', () => {
  const summary = buildLlmsSummary([
    { slug: 'a b', title: 'Spaced', description: 'x' },
    { slug: 'foo)bar', title: 'Paren', description: 'y' },
  ]);

  assert.ok(summary.includes(`(${site.origin}/writings/a%20b)`));
  assert.ok(summary.includes(`(${site.origin}/writings/foo%29bar)`));
  for (const item of listItems(summary)) assert.match(item, LIST_ITEM);
});

test('buildLlmsSummary keeps brackets in a title from ending the link text', () => {
  const summary = buildLlmsSummary([
    {
      slug: 'x',
      title: 'Notes on [draft] specs',
      description: 'About [things].',
    },
  ]);

  assert.ok(
    summary.includes(
      `- [Notes on (draft) specs](${site.origin}/writings/x): About [things].`
    )
  );
});

test('buildLlmsSummary links every feed, index, and discovery file', () => {
  const summary = buildLlmsSummary();
  const links = [
    ['Writings index', '/writings'],
    ['Initiatives', '/initiatives'],
    ['Site feed (RSS)', '/feed.xml'],
    ['Site feed (Atom)', '/feed/atom'],
    ['Site feed (JSON Feed)', '/feed/json'],
    ['Writings feed (RSS)', '/writings/feed.xml'],
    ['Writings feed (Atom)', '/writings/feed/atom'],
    ['Writings feed (JSON Feed)', '/writings/feed/json'],
    ['Public webmentions', '/webmentions?target='],
    ['security.txt', '/.well-known/security.txt'],
    ['OpenSearch description', '/opensearch.xml'],
  ];

  for (const [label, path] of links) {
    assert.ok(
      summary.includes(`[${label}](${site.origin}${path})`),
      `${label} should link to ${path}`
    );
  }
  assert.match(summary, /^## Read$/m);
  assert.match(summary, /^## Protocols$/m);
});
