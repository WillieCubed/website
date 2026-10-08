import assert from 'node:assert/strict';
import test from 'node:test';

import { hashSecret } from '@/lib/indieweb/indieauth-server';
import {
  type MediaStore,
  MediaUploadError,
  getMediaStore,
  mediaPathname,
  parseMediaUpload,
  storeMedia,
} from '@/lib/indieweb/media';
import { handleMediaPost } from '@/lib/indieweb/media-endpoint';
import { site } from '@/lib/site';

import { memoryIndieAuthStore } from './indieauth-memory-store.mts';

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
  assert.equal(getMediaStore({ BLOB_STORE_ID: 'store_test' }), null);
  assert.ok(getMediaStore({ BLOB_STORE_ID: 'store_test', VERCEL: '1' }));
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

test('media uploads accept signed audio, video, and PDF bytes and reject MIME spoofing', async () => {
  const cases: [string, Uint8Array][] = [
    ['audio/mpeg', new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0])],
    ['audio/wav', new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69])],
    [
      'video/mp4',
      new Uint8Array([
        0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0,
      ]),
    ],
    ['video/webm', new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])],
    ['application/pdf', new TextEncoder().encode('%PDF-1.7\n')],
  ];
  for (const [mime, bytes] of cases) {
    const file = await parseMediaUpload(
      upload(new File([bytes], 'upload', { type: mime }))
    );
    assert.equal(file.type, mime);
  }
  await assert.rejects(
    parseMediaUpload(
      upload(new File(['not an image'], 'spoof.jpg', { type: 'image/jpeg' }))
    ),
    MediaUploadError
  );
  await assert.rejects(
    parseMediaUpload(
      upload(
        new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.jpg', {
          type: 'image/jpeg',
        })
      )
    ),
    /4 MiB/
  );
});

test('the media endpoint checks bearer scopes, size, and signatures before storing', async () => {
  const { store } = memoryIndieAuthStore();
  const stored: string[] = [];
  const options = {
    tokenStore: store,
    mediaStore: {
      async put(path: string) {
        stored.push(path);
        return 'https://media.example/' + path;
      },
    },
  };
  const credential = async (scope: string) => {
    const token = 'media-' + scope;
    await store.saveToken(hashSecret(token), {
      clientId: 'https://client.example/',
      me: site.origin + '/',
      scope: [scope],
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    });
    return { Authorization: 'Bearer ' + token };
  };
  const missing = await handleMediaPost(upload(jpeg()), options);
  assert.equal(missing.status, 401);
  assert.equal(missing.headers.get('www-authenticate'), 'Bearer');
  const invalid = await handleMediaPost(
    upload(jpeg(), { Authorization: 'Bearer bad' }),
    options
  );
  assert.equal(invalid.status, 401);
  assert.match(invalid.headers.get('www-authenticate')!, /invalid_token/);
  const insufficient = await handleMediaPost(
    upload(jpeg(), await credential('update')),
    options
  );
  assert.equal(insufficient.status, 403);
  assert.match(
    insufficient.headers.get('www-authenticate')!,
    /insufficient_scope/
  );
  const bad = await handleMediaPost(
    upload(
      new File(['<script>bad</script>'], 'spoof.jpg', { type: 'image/jpeg' }),
      await credential('create')
    ),
    options
  );
  assert.equal(bad.status, 400);
  const large = await handleMediaPost(
    upload(
      new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'large.jpg', {
        type: 'image/jpeg',
      }),
      await credential('create')
    ),
    options
  );
  assert.equal(large.status, 413);
  assert.deepEqual(stored, []);
  const accepted = await handleMediaPost(
    upload(jpeg(), await credential('draft')),
    options
  );
  assert.equal(accepted.status, 201);
  assert.equal(accepted.headers.get('location'), (await accepted.json()).url);
  assert.equal(accepted.headers.get('access-control-allow-origin'), '*');
  assert.equal(stored.length, 1);
});
