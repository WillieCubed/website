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

test('buildLlmsSummary documents the IndieWeb protocol surfaces', () => {
  const summary = buildLlmsSummary();

  assert.match(summary, /Webmention endpoint/);
  assert.match(summary, /Micropub endpoint/);
  assert.match(summary, /activity feed/);
  assert.match(summary, /Search: /);
  assert.match(summary, /oEmbed provider/);
});
