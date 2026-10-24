import assert from 'node:assert/strict';
import test from 'node:test';

import { deliverMedia } from '@/lib/indieweb/media-delivery';

test('R2 delivery rejects invalid keys before reading the bucket', async () => {
  const keys: string[] = [];
  const bucket = {
    async get() {
      return null;
    },
    async head(key: string) {
      keys.push(key);
      return null;
    },
  };
  const invalid = [
    ['2026', '10', '..', 'private.txt'],
    ['2026', '10', 'image.svg'],
    ['2026', '10', 'image.jpg', 'extra'],
    ['2026', '13', 'image.jpg'],
    ['writings', '123', 'image.jpg'],
    ['writings', '12345678-1234-1234-1234-123456789abc', 'image.svg'],
  ];
  for (const segments of invalid) {
    assert.equal((await deliverMedia(segments, bucket)).status, 404);
  }
  assert.deepEqual(keys, []);
});

test('R2 serves promoted writing assets from the public media bucket', async () => {
  const publication = '12345678-1234-1234-1234-123456789abc';
  const asset = 'abcdef12-3456-7890-abcd-123456789abc';
  const key = `media/writings/${publication}/${asset}.png`;
  const response = await deliverMedia(
    ['writings', publication, `${asset}.png`],
    {
      async head() {
        return {
          httpEtag: '"image"',
          etag: 'image',
          size: 4,
          uploaded: new Date(),
          httpMetadata: { contentType: 'image/png' },
        };
      },
      async get(requested) {
        assert.equal(requested, key);
        return {
          httpEtag: '"image"',
          httpMetadata: { contentType: 'image/png' },
          etag: 'image',
          size: 4,
          uploaded: new Date(),
          body: new Response(new Uint8Array([137, 80, 78, 71])).body!,
        };
      },
    }
  );
  assert.equal(response.status, 200);
  assert.deepEqual(
    new Uint8Array(await response.arrayBuffer()),
    new Uint8Array([137, 80, 78, 71])
  );
});

test('R2 delivery returns exact bytes with immutable cache and stored type', async () => {
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
  const key = 'media/2026/10/image-1234.jpg';
  const response = await deliverMedia(['2026', '10', 'image-1234.jpg'], {
    async head() {
      return {
        httpEtag: '"r2-etag"',
        etag: 'r2-etag',
        size: 4,
        uploaded: new Date(),
        httpMetadata: { contentType: 'image/jpeg' },
      };
    },
    async get(requested: string) {
      assert.equal(requested, key);
      return {
        httpEtag: '"r2-etag"',
        httpMetadata: { contentType: 'image/jpeg' },
        etag: 'r2-etag',
        size: 4,
        uploaded: new Date(),
        body: new Response(bytes).body!,
      };
    },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/jpeg');
  assert.equal(response.headers.get('etag'), '"r2-etag"');
  assert.equal(
    response.headers.get('cache-control'),
    'public, max-age=31536000, immutable'
  );
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
});

test('R2 delivery distinguishes missing bindings and missing objects', async () => {
  const segments = ['2026', '10', 'missing.jpg'];
  assert.equal((await deliverMedia(segments, undefined)).status, 503);
  assert.equal(
    (
      await deliverMedia(segments, {
        async head() {
          return null;
        },
        async get() {
          return null;
        },
      })
    ).status,
    404
  );
});
