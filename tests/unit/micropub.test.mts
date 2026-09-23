import { POST as postMicropub } from '@/app/micropub/route';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMicropubWritingFile,
  getMicropubConfig,
  getMicropubSyndicationTargets,
  parseMicropubCreateRequest,
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

test('getMicropubConfig advertises Bluesky and Threads by stable uid', () => {
  const expected = [
    { uid: 'https://bsky.app/profile/willie.page', name: 'Bluesky' },
    { uid: 'https://www.threads.com/@williecubed', name: 'Threads' },
  ];

  assert.deepEqual(getMicropubConfig()['syndicate-to'], expected);
  assert.deepEqual(getMicropubSyndicationTargets(), expected);
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

test('parseMicropubCreateRequest resolves form mp-syndicate-to[] targets', async () => {
  const body = new URLSearchParams([
    ['h', 'entry'],
    ['content', 'Cross-posted note.'],
    ['mp-syndicate-to[]', 'https://www.threads.com/@williecubed'],
    ['mp-syndicate-to[]', 'https://bsky.app/profile/willie.page'],
  ]);

  const entry = await parseMicropubCreateRequest(micropubRequest(body));

  assert.deepEqual(
    entry.syndicateTo.map((target) => target.name),
    ['Bluesky', 'Threads']
  );
});

test('parseMicropubCreateRequest resolves JSON mp-syndicate-to targets', async () => {
  const entry = await parseMicropubCreateRequest(
    micropubRequest({
      type: ['h-entry'],
      properties: {
        content: ['Cross-posted note.'],
        'mp-syndicate-to': ['https://bsky.app/profile/willie.page'],
      },
    })
  );

  assert.deepEqual(entry.syndicateTo, [
    { uid: 'https://bsky.app/profile/willie.page', name: 'Bluesky' },
  ]);
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

test('buildMicropubWritingFile records chosen targets as syndication links', () => {
  const file = buildMicropubWritingFile(
    {
      ...baseEntry,
      syndication: ['https://bsky.app/profile/willie.page'],
      syndicateTo: getMicropubSyndicationTargets(),
    },
    'small-note'
  );

  assert.match(
    file,
    /syndication:\n {2}- name: "bsky\.app"\n {4}url: "https:\/\/bsky\.app\/profile\/willie\.page"\n {2}- name: "Threads"\n {4}url: "https:\/\/www\.threads\.com\/@williecubed"\n---/
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
