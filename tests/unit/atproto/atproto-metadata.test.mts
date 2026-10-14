import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDocumentMetadata } from '@/lib/atproto/metadata';

test('optional metadata retains open union payloads, contributors and labels', () => {
  const metadata = {
    contributors: [{ did: 'did:plc:abcdefghijklmnopqrstuvwx', role: 'editor' }],
    content: {
      $type: 'dev.example.content',
      paragraphs: [{ text: 'Extension content' }],
    },
    links: { $type: 'dev.example.links', parent: 'https://example.com' },
    labels: {
      $type: 'com.atproto.label.defs#selfLabels',
      values: [{ val: 'nudity' }],
    },
  };
  assert.deepEqual(parseDocumentMetadata(metadata), metadata);
});
test('explicit null removes metadata while omitted fields remain omitted', () => {
  assert.deepEqual(parseDocumentMetadata({ content: null, links: null }), {
    content: null,
    links: null,
  });
  assert.equal(parseDocumentMetadata(undefined), undefined);
});
test('known malformed union members and non-owner Bluesky references fail authoring', () => {
  assert.throws(
    () =>
      parseDocumentMetadata({
        content: { $type: 'app.bsky.feed.post', text: 'Missing date' },
      }),
    /Invalid/
  );
  assert.throws(() => parseDocumentMetadata({ links: [] }), /object/);
  assert.throws(
    () =>
      parseDocumentMetadata({
        bskyPostRef: {
          uri: 'at://did:plc:abcdefghijklmnopqrstuvwx/app.bsky.feed.post/3mwa5ei54c22g',
          cid: 'bafyreihffx5a2e7k5uwrmmgofbvzujc5cmw5h4espouwuxt3liqoflx3ee',
        },
      }),
    /publication account/
  );
});
