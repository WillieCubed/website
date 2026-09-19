import assert from 'node:assert/strict';
import test from 'node:test';

import { OPENSEARCH_CONTENT_TYPE, buildOpenSearchXml } from '@/lib/opensearch';
import { site } from '@/lib/site';

test('OpenSearch points browsers at the search page with the terms placeholder', () => {
  assert.match(
    buildOpenSearchXml(),
    new RegExp(
      `<Url type="text/html" method="get" template="${site.origin}/search\\?q=\\{searchTerms\\}" />`
    )
  );
});

test('OpenSearch names the engine after the site within the spec limits', () => {
  const xml = buildOpenSearchXml();
  const shortName = /<ShortName>(.*)<\/ShortName>/.exec(xml)?.[1] ?? '';

  assert.equal(shortName, site.shortName);
  assert.ok(shortName.length <= 16, 'ShortName is limited to 16 characters');
  assert.match(xml, /<Description>Search .+<\/Description>/);
});

test('OpenSearch declares UTF-8 input', () => {
  assert.match(buildOpenSearchXml(), /<InputEncoding>UTF-8<\/InputEncoding>/);
});

test('OpenSearch is served as an OpenSearch description document', () => {
  assert.equal(
    OPENSEARCH_CONTENT_TYPE,
    'application/opensearchdescription+xml; charset=utf-8'
  );
});
