import {
  POST as postMicropub,
  readMicropubAccessToken,
} from '@/app/micropub/route';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMicropubWritingFile,
  getMicropubConfig,
  getMicropubSyndicationTargets,
  parseMicropubCreateRequest,
  prepareMicropubPhotoRequest,
} from '@/lib/indieweb/micropub';
import type { MicropubCreateRequest } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

const baseEntry: MicropubCreateRequest = {
  h: 'entry',
  content: 'A small note from the IndieWeb.',
  categories: ['indieweb'],
  published: new Date('2026-05-19T12:00:00Z'),
  postType: 'note',
  syndication: [],
  syndicateTo: [],
  photos: [],
};

test('getMicropubConfig advertises supported personal-site post types', () => {
  const config = getMicropubConfig(true);

  assert.equal(config['media-endpoint'], `${site.origin}/micropub/media`);
  assert.deepEqual(
    config['post-types'].map((postType) => postType.type),
    ['note', 'photo', 'article', 'reply', 'like', 'repost', 'bookmark', 'rsvp']
  );
});

test('getMicropubConfig omits unavailable media uploads', () => {
  const config = getMicropubConfig(false);

  assert.equal(config['media-endpoint'], undefined);
  assert.ok(config['post-types'].some((postType) => postType.type === 'photo'));
});

test('POST /micropub rejects a bearer token sent in both places', async () => {
  const body = new URLSearchParams({
    h: 'entry',
    content: 'This must not be published.',
    access_token: 'duplicate-token',
  });
  const response = await postMicropub(
    new Request(`${site.origin}/micropub`, {
      method: 'POST',
      headers: { Authorization: 'Bearer duplicate-token' },
      body,
    })
  );

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'invalid_request');
});

test('Micropub accepts a form token and refuses ambiguous credentials', async () => {
  const request = (body: URLSearchParams, authorization?: string) =>
    new Request(`${site.origin}/micropub`, {
      method: 'POST',
      headers: authorization ? { Authorization: authorization } : {},
      body,
    });

  assert.deepEqual(
    await readMicropubAccessToken(
      request(new URLSearchParams({ access_token: 'form-token' }))
    ),
    { token: 'form-token' }
  );
  assert.deepEqual(
    await readMicropubAccessToken(
      request(
        new URLSearchParams({ access_token: 'form-token' }),
        'Bearer header-token'
      )
    ),
    { error: 'invalid_request' }
  );
  assert.deepEqual(
    await readMicropubAccessToken(request(new URLSearchParams())),
    { error: 'unauthorized' }
  );
  assert.deepEqual(
    await readMicropubAccessToken(
      new Request(`${site.origin}/micropub`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer header-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: 'body-token' }),
      })
    ),
    { error: 'invalid_request' }
  );
});

test('Micropub offers the Bluesky and Threads accounts as syndication targets', () => {
  const targets = getMicropubSyndicationTargets();

  assert.deepEqual(targets, [
    {
      uid: 'https://bsky.app/profile/willie.page',
      name: 'willie.page on Bluesky',
      service: { name: 'Bluesky', url: 'https://bsky.app/' },
      user: {
        name: 'willie.page',
        url: 'https://bsky.app/profile/willie.page',
      },
    },
    {
      uid: 'https://www.threads.com/@williecubed',
      name: '@williecubed on Threads',
      service: { name: 'Threads', url: 'https://www.threads.com/' },
      user: {
        name: '@williecubed',
        url: 'https://www.threads.com/@williecubed',
      },
    },
  ]);
  assert.deepEqual(getMicropubConfig(false)['syndicate-to'], targets);
});

test('parseMicropubCreateRequest accepts form-encoded replies', async () => {
  const body = new URLSearchParams({
    h: 'entry',
    content: 'This is a reply.',
    'in-reply-to': 'https://example.com/post',
    category: 'reply,indieweb',
    'mp-slug': 'reply-to-example',
  });

  const request = new Request(`${site.origin}/micropub`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const entry = await parseMicropubCreateRequest(request);

  assert.equal(entry.postType, 'reply');
  assert.equal(entry.inReplyTo, 'https://example.com/post');
  assert.deepEqual(entry.categories, ['reply', 'indieweb']);
  assert.equal(entry.slug, 'reply-to-example');
});

test('buildMicropubWritingFile emits reusable writing frontmatter', () => {
  const file = buildMicropubWritingFile(baseEntry, 'small-note');

  assert.match(file, /postType: "note"/);
  assert.match(file, /tags: \["indieweb"\]/);
  assert.match(file, /published: 2026-05-19T12:00:00.000Z/);
  assert.match(file, /A small note from the IndieWeb\./);
});

function micropubRequest(body: URLSearchParams | object): Request {
  const json = !(body instanceof URLSearchParams);
  return new Request(`${site.origin}/micropub`, {
    method: 'POST',
    headers: {
      'Content-Type': json
        ? 'application/json'
        : 'application/x-www-form-urlencoded',
    },
    body: json ? JSON.stringify(body) : body,
  });
}

test('parseMicropubCreateRequest records form targets as intent, not copies', async () => {
  const body = new URLSearchParams([
    ['h', 'entry'],
    ['content', 'Cross-posted note.'],
    ['mp-syndicate-to[]', 'https://www.threads.com/@williecubed'],
    ['mp-syndicate-to[]', 'https://bsky.app/profile/willie.page'],
  ]);

  const entry = await parseMicropubCreateRequest(micropubRequest(body));
  assert.deepEqual(
    entry.syndicateTo.map(({ uid }) => uid),
    [
      'https://www.threads.com/@williecubed',
      'https://bsky.app/profile/willie.page',
    ]
  );
  const file = buildMicropubWritingFile(entry, 'cross-posted-note');
  assert.match(
    file,
    /\nsyndicateTo: \["https:\/\/www\.threads\.com\/@williecubed","https:\/\/bsky\.app\/profile\/willie\.page"\]\n/
  );
  assert.doesNotMatch(file, /\nsyndication:/);
});

test('parseMicropubCreateRequest reads JSON syndication targets', async () => {
  const entry = await parseMicropubCreateRequest(
    micropubRequest({
      type: ['h-entry'],
      properties: {
        content: ['Cross-posted note.'],
        'mp-syndicate-to': ['https://bsky.app/profile/willie.page'],
      },
    })
  );

  assert.deepEqual(
    entry.syndicateTo.map(({ name }) => name),
    ['willie.page on Bluesky']
  );
});

test('parseMicropubCreateRequest reads JSON citations embedded as h-cites', async () => {
  const cite = (url: string) => ({
    type: ['h-cite'],
    properties: { url: [url], name: ['The cited post'] },
  });
  const reply = await parseMicropubCreateRequest(
    micropubRequest({
      type: ['h-entry'],
      properties: {
        content: ['Agreed.'],
        'in-reply-to': [cite('https://example.com/posts/1')],
      },
    })
  );
  assert.equal(reply.inReplyTo, 'https://example.com/posts/1');
  assert.equal(reply.postType, 'reply');

  for (const property of ['like-of', 'repost-of', 'bookmark-of'] as const) {
    const entry = await parseMicropubCreateRequest(
      micropubRequest({
        type: ['h-entry'],
        properties: {
          content: ['Cited.'],
          [property]: [{ value: 'https://example.com/posts/2' }],
        },
      })
    );
    const field = {
      'like-of': entry.likeOf,
      'repost-of': entry.repostOf,
      'bookmark-of': entry.bookmarkOf,
    }[property];
    assert.equal(field, 'https://example.com/posts/2', property);
  }

  const file = buildMicropubWritingFile(reply, 'agreed');
  assert.match(file, /inReplyTo: "https:\/\/example\.com\/posts\/1"/);
});

test('parseMicropubCreateRequest refuses a JSON citation with no address', async () => {
  await assert.rejects(
    parseMicropubCreateRequest(
      micropubRequest({
        type: ['h-entry'],
        properties: {
          content: ['Replying to nothing.'],
          'in-reply-to': [{ type: ['h-cite'], properties: { name: ['?'] } }],
        },
      })
    ),
    /invalid_request/
  );
});

test('parseMicropubCreateRequest rejects a target it never advertised', async () => {
  const body = new URLSearchParams({
    h: 'entry',
    content: 'Cross-posted note.',
    'mp-syndicate-to': 'https://example.com/elsewhere',
  });

  await assert.rejects(
    parseMicropubCreateRequest(micropubRequest(body)),
    /invalid_request/
  );
});

test('buildMicropubWritingFile records actual copy permalinks', () => {
  const file = buildMicropubWritingFile(
    {
      ...baseEntry,
      syndication: ['https://bsky.app/profile/willie.page/post/3abc'],
      syndicateTo: [],
    },
    'small-note'
  );

  assert.match(
    file,
    /syndication:\n {2}- name: "Bluesky"\n {4}url: "https:\/\/bsky\.app\/profile\/willie\.page\/post\/3abc"\n---/
  );
});

test('parseMicropubCreateRequest accepts a form photo note without a caption', async () => {
  const body = new URLSearchParams([
    ['h', 'entry'],
    ['photo[]', 'https://example.blob.vercel-storage.com/media/a.jpg'],
    ['photo[]', 'https://example.blob.vercel-storage.com/media/b,c.jpg'],
  ]);

  const entry = await parseMicropubCreateRequest(micropubRequest(body));

  assert.equal(entry.postType, 'photo');
  assert.equal(entry.content, '');
  assert.deepEqual(entry.photos, [
    { url: 'https://example.blob.vercel-storage.com/media/a.jpg' },
    { url: 'https://example.blob.vercel-storage.com/media/b,c.jpg' },
  ]);
});

test('parseMicropubCreateRequest reads JSON photos with alt text', async () => {
  const entry = await parseMicropubCreateRequest(
    micropubRequest({
      type: ['h-entry'],
      properties: {
        content: ['Sunset over the Strip.'],
        photo: [
          {
            value: 'https://example.blob.vercel-storage.com/media/sunset.jpg',
            alt: 'An orange sky behind the Las Vegas skyline',
          },
          'https://example.blob.vercel-storage.com/media/crowd.jpg',
        ],
      },
    })
  );

  assert.equal(entry.postType, 'photo');
  assert.deepEqual(entry.photos, [
    {
      url: 'https://example.blob.vercel-storage.com/media/sunset.jpg',
      alt: 'An orange sky behind the Las Vegas skyline',
    },
    { url: 'https://example.blob.vercel-storage.com/media/crowd.jpg' },
  ]);
});

test('parseMicropubCreateRequest rejects a photo that is not a web URL', async () => {
  for (const photo of ['not a url', 'javascript:alert(1)']) {
    await assert.rejects(
      parseMicropubCreateRequest(
        micropubRequest(new URLSearchParams({ h: 'entry', photo }))
      ),
      /invalid_request/,
      photo
    );
  }
});

test('parseMicropubCreateRequest refuses a photo file sent to the post endpoint', async () => {
  const body = new FormData();
  body.set('h', 'entry');
  body.set('content', 'Caption.');
  body.set('photo', new File(['jpeg'], 'a.jpg', { type: 'image/jpeg' }));

  await assert.rejects(
    parseMicropubCreateRequest(
      new Request(`${site.origin}/micropub`, { method: 'POST', body })
    ),
    /invalid_request/
  );
});

test('multipart photo creation stores the file before parsing the post', async () => {
  const form = new FormData();
  form.set('h', 'entry');
  form.set(
    'photo',
    new File([new Uint8Array([0xff, 0xd8])], 'photo.jpg', {
      type: 'image/jpeg',
    })
  );
  const request = new Request(`${site.origin}/micropub`, {
    method: 'POST',
    body: form,
  });
  const prepared = await prepareMicropubPhotoRequest(request, {
    async put() {
      return 'https://media.example/photo.jpg';
    },
  });
  const entry = await parseMicropubCreateRequest(prepared);
  assert.deepEqual(entry.photos, [{ url: 'https://media.example/photo.jpg' }]);
  assert.equal(entry.postType, 'photo');
});

test('buildMicropubWritingFile records photos with their alt text', () => {
  const file = buildMicropubWritingFile(
    {
      ...baseEntry,
      content: '',
      postType: 'photo',
      photos: [
        { url: 'https://example.com/a.jpg', alt: 'A bus at dusk' },
        { url: 'https://example.com/b.jpg' },
      ],
    },
    'photo-note'
  );

  assert.match(file, /postType: "photo"/);
  assert.match(file, /title: "Photo from 2026-05-19"/);
  assert.match(file, /description: "A photo from /);
  assert.match(
    file,
    /photo:\n {2}- url: "https:\/\/example\.com\/a\.jpg"\n {4}alt: "A bus at dusk"\n {2}- url: "https:\/\/example\.com\/b\.jpg"\n/
  );
});
