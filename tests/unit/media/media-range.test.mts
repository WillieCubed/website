import assert from 'node:assert/strict';
import test from 'node:test';

import { deliverMedia } from '@/lib/indieweb/media-delivery';

const segments = ['2026', '10', 'clip.mp4'];
const metadata = {
  httpEtag: '"clip"',
  etag: 'clip',
  size: 10,
  uploaded: new Date('2026-10-01T00:00:00Z'),
  httpMetadata: { contentType: 'video/mp4' },
};
function bucket() {
  let reads = 0;
  return {
    get reads() {
      return reads;
    },
    async head() {
      return metadata;
    },
    async get(
      _key: string,
      options?: { range?: { offset: number; length: number } }
    ) {
      reads += 1;
      const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const range = options?.range;
      const body = range
        ? bytes.slice(range.offset, range.offset + range.length)
        : bytes;
      return {
        ...metadata,
        body: new Response(body).body!,
        arrayBuffer: async () => body.buffer,
      };
    },
  };
}
function request(headers: HeadersInit = {}, method = 'GET') {
  return new Request('https://willie.page/media/2026/10/clip.mp4', {
    method,
    headers,
  });
}

test('media streams the requested byte interval with its representation length', async () => {
  const response = await deliverMedia(
    segments,
    bucket(),
    request({ Range: 'bytes=2-5' })
  );
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 2-5/10');
  assert.equal(response.headers.get('Content-Length'), '4');
  assert.deepEqual(
    [...new Uint8Array(await response.arrayBuffer())],
    [2, 3, 4, 5]
  );
});

test('media supports suffix and open-ended ranges', async () => {
  for (const [range, expected] of [
    ['bytes=-2', [8, 9]],
    ['bytes=8-', [8, 9]],
  ] as const) {
    const response = await deliverMedia(
      segments,
      bucket(),
      request({ Range: range })
    );
    assert.equal(response.status, 206);
    assert.deepEqual(
      [...new Uint8Array(await response.arrayBuffer())],
      expected
    );
  }
});

test('HEAD and matching validators never read the media body', async () => {
  const source = bucket();
  const head = await deliverMedia(segments, source, request({}, 'HEAD'));
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Content-Length'), '10');
  assert.equal(await head.text(), '');
  const unchanged = await deliverMedia(
    segments,
    source,
    request({ 'If-None-Match': 'W/"clip"' })
  );
  assert.equal(unchanged.status, 304);
  assert.equal(await unchanged.text(), '');
  assert.equal(source.reads, 0);
});

test('an unsatisfied range returns 416 without reading the body', async () => {
  const source = bucket();
  const response = await deliverMedia(
    segments,
    source,
    request({ Range: 'bytes=10-' })
  );
  assert.equal(response.status, 416);
  assert.equal(response.headers.get('Content-Range'), 'bytes */10');
  assert.equal(source.reads, 0);
});

test('an unmatched or weak If-Range delivers the complete representation', async () => {
  for (const validator of [
    '"old"',
    'W/"clip"',
    'Wed, 30 Sep 2026 00:00:00 GMT',
    'Fri, 02 Oct 2026 00:00:00 GMT',
  ]) {
    const response = await deliverMedia(
      segments,
      bucket(),
      request({ Range: 'bytes=2-5', 'If-Range': validator })
    );
    assert.equal(response.status, 200);
    assert.equal((await response.arrayBuffer()).byteLength, 10);
  }
});

test('a matching If-Range date delivers the byte range', async () => {
  const response = await deliverMedia(
    segments,
    bucket(),
    request({ Range: 'bytes=2-5', 'If-Range': metadata.uploaded.toUTCString() })
  );
  assert.equal(response.status, 206);
});

test('a changed representation cannot stream with stale metadata', async () => {
  const source = {
    async head() {
      return metadata;
    },
    async get() {
      return { ...metadata, body: undefined };
    },
  };
  const response = await deliverMedia(segments, source, request());
  assert.equal(response.status, 412);
  assert.equal(await response.text(), '');
});
