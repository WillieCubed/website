import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAtProtocolDid,
  buildHostMetaResponse,
  buildHostMetaXml,
  buildLlmsSummary,
  buildWebFingerResponse,
} from '@/lib/indieweb/discovery';
import { site } from '@/lib/site';

test('buildWebFingerResponse exposes profile, webmention, and Micropub links', () => {
  const response = buildWebFingerResponse(
    `acct:${site.author.handle}@${new URL(site.origin).hostname}`
  );

  assert.equal(
    response.subject,
    `acct:${site.author.handle}@${new URL(site.origin).hostname}`
  );
  assert.ok(response.aliases.includes(site.origin));
  assert.ok(response.links.some((link) => link.rel === 'micropub'));
  assert.ok(
    response.links.some((link) => link.href === `${site.origin}/webmention`)
  );
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
