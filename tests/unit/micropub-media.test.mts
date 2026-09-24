import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type MediaStore,
  MediaUploadError,
  getMediaStore,
  mediaPathname,
  parseMediaUpload,
  storeMedia,
} from '@/lib/indieweb/media';
import { site } from '@/lib/site';

const endpoint = `${site.origin}/micropub/media`;

function upload(file?: File, headers: HeadersInit = {}): Request {
  const body = new FormData();
  if (file) body.set('file', file);
  return new Request(endpoint, { method: 'POST', body, headers });
}

const jpeg = () =>
  new File([new Uint8Array([0xff, 0xd8, 0xff])], 'IMG 0042.JPG', {
    type: 'image/jpeg',
  });

test('getMediaStore requires a Blob token or a configured OIDC store', () => {
  assert.equal(getMediaStore({}), null);
  assert.equal(getMediaStore({ BLOB_READ_WRITE_TOKEN: '  ' }), null);
  assert.ok(getMediaStore({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_x' }));
  assert.ok(
    getMediaStore({
      BLOB_STORE_ID: 'store_test',
      VERCEL_OIDC_TOKEN: 'oidc-test',
    })
  );
  assert.ok(getMediaStore({ BLOB_STORE_ID: 'store_test' }));
});

test('parseMediaUpload returns the multipart file part', async () => {
  const file = await parseMediaUpload(upload(jpeg()));

  assert.equal(file.type, 'image/jpeg');
  assert.equal(file.size, 3);
});

test('parseMediaUpload refuses anything but a photo in the file part', async () => {
  const cases: [string, Request][] = [
    [
      'not multipart',
      new Request(endpoint, { method: 'POST', body: 'file=a.jpg' }),
    ],
    ['no file part', upload()],
    ['empty file', upload(new File([], 'a.jpg', { type: 'image/jpeg' }))],
    ['svg', upload(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))],
    ['pdf', upload(new File(['%PDF'], 'a.pdf', { type: 'application/pdf' }))],
  ];

  for (const [name, request] of cases) {
    await assert.rejects(parseMediaUpload(request), MediaUploadError, name);
  }
});

test('mediaPathname files uploads by month under a cleaned-up name', () => {
  const now = new Date('2026-09-22T12:00:00Z');

  assert.equal(mediaPathname(jpeg(), now), 'media/2026/09/img-0042.jpg');
  assert.equal(
    mediaPathname(new File(['x'], '.png', { type: 'image/png' }), now),
    'media/2026/09/photo.png'
  );
});

test('storeMedia hands the store the pathname and type, and returns its URL', async () => {
  const calls: [string, string][] = [];
  const store: MediaStore = {
    async put(pathname, _file, contentType) {
      calls.push([pathname, contentType]);
      return `https://media.example/${pathname}`;
    },
  };

  const url = await storeMedia(jpeg(), store, new Date('2026-09-22T12:00:00Z'));

  assert.equal(url, 'https://media.example/media/2026/09/img-0042.jpg');
  assert.deepEqual(calls, [['media/2026/09/img-0042.jpg', 'image/jpeg']]);
});

test('POST /micropub/media answers 503 until storage is configured', async () => {
  const saved = process.env.BLOB_READ_WRITE_TOKEN;
  const { POST } = await import('@/app/micropub/media/route');
  try {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const off = await POST(upload(jpeg(), { Authorization: 'Bearer token' }));
    assert.equal(off.status, 503);
    assert.match((await off.json()).error_description, /BLOB_READ_WRITE_TOKEN/);

    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_test';
    const anonymous = await POST(upload(jpeg()));
    assert.equal(anonymous.status, 401);
  } finally {
    if (saved === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
    else process.env.BLOB_READ_WRITE_TOKEN = saved;
  }
});
