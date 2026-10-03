import assert from 'node:assert/strict';
import test from 'node:test';

import { publishingIdentity } from '@/lib/atproto/config';
import { HUMANS_STANDARDS } from '@/lib/humans-txt';
import { buildLlmsSummary } from '@/lib/indieweb/discovery';
import { site } from '@/lib/site';

test('the publication well-known answers with the AT-URI alone', async () => {
  const { GET } =
    await import('@/app/.well-known/site.standard.publication/route');
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(await response.text(), publishingIdentity().publicationUri);
  assert.match(response.headers.get('Content-Type') ?? '', /^text\/plain/);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

test('llms.txt and humans.txt name the AT Protocol endpoints', () => {
  const llms = buildLlmsSummary();
  assert.ok(
    llms.includes(`${site.origin}/.well-known/site.standard.publication`)
  );
  assert.ok(llms.includes(`${site.origin}/.well-known/atproto-did`));
  assert.ok(HUMANS_STANDARDS.includes('standard.site'));
  assert.ok(HUMANS_STANDARDS.includes('AT Protocol'));
});
