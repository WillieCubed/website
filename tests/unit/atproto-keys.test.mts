import * as TID from '@atcute/tid';
import assert from 'node:assert/strict';
import test from 'node:test';

import { publishingIdentity } from '@/lib/atproto/config';
import { documentRkey, documentUri } from '@/lib/atproto/keys';
import { site } from '@/lib/site';

const published = new Date('2026-09-23T18:51:00-07:00');

test("the publication lives at the configured key in the owner's repo", () => {
  const { did, publicationRkey, publicationUri } = publishingIdentity();
  assert.equal(did, site.author.atprotoDid);
  assert.ok(TID.validate(publicationRkey));
  assert.equal(
    publicationUri,
    `at://${did}/site.standard.publication/${publicationRkey}`
  );
});

test('a document key encodes its publish time and never drifts', () => {
  const key = documentRkey('/writings/fall-tour-2026-begins', published);
  assert.ok(TID.validate(key));
  assert.equal(TID.parse(key).timestamp, published.getTime() * 1000);
  // Pinned: a different key here would orphan every published record.
  assert.equal(key, '3mwa5ei54c22g');
});

test('two writings published the same minute get different keys', () => {
  assert.notEqual(
    documentRkey('/writings/a', published),
    documentRkey('/writings/b', published)
  );
});

test("a document URI names the document collection in the owner's repo", () => {
  assert.equal(
    documentUri('/writings/fall-tour-2026-begins', published),
    `at://${site.author.atprotoDid}/site.standard.document/3mwa5ei54c22g`
  );
});
