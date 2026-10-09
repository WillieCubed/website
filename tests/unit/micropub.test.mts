import { POST as postMicropub } from '@/app/micropub/route';
import matter from 'gray-matter';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMicropubWritingFile,
  commitMicropubWriting,
  getMicropubConfig,
  getMicropubSyndicationTargets,
  micropubWritingPath,
  parseMicropubCreateRequest,
} from '@/lib/indieweb/micropub';
import {
  MicropubRequestError,
  micropubSource,
} from '@/lib/indieweb/micropub-document';
import { readMicropubAccessToken } from '@/lib/indieweb/micropub-endpoint';
import type { MicropubCreateRequest } from '@/lib/indieweb/types';
import { RESERVED_WRITING_SLUGS } from '@/lib/indieweb/utils';
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
    [
      'note',
      'photo',
      'article',
      'reply',
      'like',
      'repost',
      'bookmark',
      'rsvp',
      'audio',
      'video',
      'event',
    ]
  );
  assert.deepEqual(config.q, ['config', 'source', 'syndicate-to', 'category']);
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

// tests/unit/test.env configures the Bluesky account these tests read back.
const bluesky = site.syndication.find(
  (account) => account.service === 'Bluesky'
);
const threads = site.syndication.find(
  (account) => account.service === 'Threads'
);

async function withAvailableBluesky(run: () => Promise<void>) {
  const previous = process.env.ATPROTO_APP_PASSWORD;
  process.env.ATPROTO_APP_PASSWORD = 'test-syndication-capability';
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env.ATPROTO_APP_PASSWORD;
    else process.env.ATPROTO_APP_PASSWORD = previous;
  }
}

test('Micropub offers the Bluesky and Threads accounts as syndication targets', () => {
  assert.ok(bluesky && threads, 'both accounts are configured');
  assert.equal(
    bluesky.profile,
    `${bluesky.serviceUrl}profile/${site.author.atprotoDid}`,
    'the Bluesky profile is linked by DID'
  );
  const targets = getMicropubSyndicationTargets();

  assert.deepEqual(
    targets,
    [bluesky, threads].map((account) => ({
      uid: account.profile,
      name: `${account.handle} on ${account.service}`,
      service: { name: account.service, url: account.serviceUrl },
      user: { name: account.handle, url: account.profile },
    }))
  );
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

test('parseMicropubCreateRequest records advertised form targets as intent', async () => {
  await withAvailableBluesky(async () => {
    const body = new URLSearchParams([
      ['h', 'entry'],
      ['content', 'Cross-posted note.'],
      ['mp-syndicate-to[]', bluesky!.profile],
    ]);
    const entry = await parseMicropubCreateRequest(micropubRequest(body));
    assert.deepEqual(
      entry.syndicateTo.map(({ uid }) => uid),
      [bluesky!.profile]
    );
    const file = buildMicropubWritingFile(entry, 'cross-posted-note');
    assert.match(file, /syndicateTo:/);
    assert.doesNotMatch(file, /\nsyndication:/);
  });
});

test('parseMicropubCreateRequest reads JSON syndication targets', async () => {
  await withAvailableBluesky(async () => {
    const entry = await parseMicropubCreateRequest(
      micropubRequest({
        type: ['h-entry'],
        properties: {
          content: ['Cross-posted note.'],
          'mp-syndicate-to': [bluesky!.profile],
        },
      })
    );
    assert.deepEqual(
      entry.syndicateTo.map(({ name }) => name),
      [`${bluesky!.handle} on Bluesky`]
    );
  });
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
      syndication: ['https://bsky.app/profile/alice.example/post/3abc'],
      syndicateTo: [],
    },
    'small-note'
  );

  assert.match(
    file,
    /syndication:\n {2}- name: "Bluesky"\n {4}url: "https:\/\/bsky\.app\/profile\/alice\.example\/post\/3abc"\n---/
  );
});

test('parseMicropubCreateRequest rejects form photos without alt text', async () => {
  const body = new URLSearchParams([
    ['h', 'entry'],
    ['photo[]', 'https://example.blob.vercel-storage.com/media/a.jpg'],
    ['photo[]', 'https://example.blob.vercel-storage.com/media/b,c.jpg'],
  ]);

  await assert.rejects(
    parseMicropubCreateRequest(micropubRequest(body)),
    /JSON photo object containing value and alt/
  );
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
          {
            value: 'https://example.blob.vercel-storage.com/media/crowd.jpg',
            alt: 'People gathering on the Strip',
          },
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
    {
      url: 'https://example.blob.vercel-storage.com/media/crowd.jpg',
      alt: 'People gathering on the Strip',
    },
  ]);
});

test('Micropub rejects bare, blank, and whitespace-only JSON photo descriptions', async () => {
  for (const photo of [
    'https://example.com/photo.jpg',
    { value: 'https://example.com/photo.jpg', alt: '' },
    { value: 'https://example.com/photo.jpg', alt: '   ' },
  ]) {
    await assert.rejects(
      parseMicropubCreateRequest(
        micropubRequest({ type: ['h-entry'], properties: { photo: [photo] } })
      ),
      /Photo 1 needs nonblank alt text/
    );
  }
});

test('parseMicropubCreateRequest rejects a photo that is not a web URL', async () => {
  for (const photo of ['not a url', 'javascript:alert(1)']) {
    await assert.rejects(
      parseMicropubCreateRequest(
        micropubRequest({
          type: ['h-entry'],
          properties: { photo: [{ value: photo, alt: 'A photo' }] },
        })
      ),
      /invalid_request/,
      photo
    );
  }
});

test('parseMicropubCreateRequest directs photo files to the media endpoint', async () => {
  const body = new FormData();
  body.set('h', 'entry');
  body.set('content', 'Caption.');
  body.set('photo', new File(['jpeg'], 'a.jpg', { type: 'image/jpeg' }));

  await assert.rejects(
    parseMicropubCreateRequest(
      new Request(`${site.origin}/micropub`, { method: 'POST', body })
    ),
    /Upload the file to \/micropub\/media/
  );
});

test('multipart photo creation cannot publish an upload without alt text', async () => {
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
  await assert.rejects(
    parseMicropubCreateRequest(request),
    /Upload the file to \/micropub\/media/
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
        { url: 'https://example.com/b.jpg', alt: 'A second bus at dusk' },
      ],
    },
    'photo-note'
  );

  assert.match(file, /postType: "photo"/);
  assert.match(file, /title: "Photo from 2026-05-19"/);
  assert.match(file, /description: "A photo from /);
  assert.match(
    file,
    /photo:\n {2}- url: "https:\/\/example\.com\/a\.jpg"\n {4}alt: "A bus at dusk"\n {2}- url: "https:\/\/example\.com\/b\.jpg"\n {4}alt: "A second bus at dusk"\n/
  );
});

test('Micropub refuses invalid photos before a GitHub commit', async () => {
  await assert.rejects(
    commitMicropubWriting(
      { ...baseEntry, photos: [{ url: 'https://example.com/photo.jpg' }] },
      { repository: 'willie/website', token: 'test', branch: 'main' }
    ),
    /Photo 1 needs nonblank alt text/
  );
});

test('micropubWritingPath keeps an mp-slug inside the writings directory', () => {
  for (const slug of ['../../app/evil', 'notes/../../evil', '_template']) {
    assert.throws(
      () => micropubWritingPath({ ...baseEntry, slug }, 'content/writings'),
      MicropubRequestError,
      slug
    );
  }
  assert.deepEqual(
    micropubWritingPath(
      { ...baseEntry, slug: 'Bus_lane-2' },
      'content/writings'
    ),
    { slug: 'Bus_lane-2', path: 'content/writings/Bus_lane-2.mdx' }
  );
});

test('micropubWritingPath refuses an mp-slug a /writings route already answers', () => {
  for (const slug of RESERVED_WRITING_SLUGS) {
    assert.throws(
      () => micropubWritingPath({ ...baseEntry, slug }, 'content/writings'),
      (error) =>
        error instanceof MicropubRequestError &&
        error.description.includes(`/writings/${slug} route`),
      slug
    );
  }
});

test('micropubWritingPath moves a made slug off a route name', () => {
  const { slug } = micropubWritingPath(
    { ...baseEntry, content: 'Tags' },
    'content/writings'
  );
  assert.match(slug, /^tags-\d+$/);
});

test('Micropub preserves nested and multivalued properties across a draft source round trip', async () => {
  const cite = {
    type: ['h-cite'],
    properties: {
      url: ['https://example.com/post'],
      name: ['Cited title'],
      author: [
        {
          type: ['h-card'],
          properties: { name: ['Alice'], url: ['https://alice.example/'] },
        },
      ],
    },
  };
  const properties = {
    content: ['Literal {process.exit()} and <script>text</script>.'],
    'in-reply-to': [cite, 'https://example.com/another'],
    category: [
      'bus',
      {
        type: ['h-card'],
        properties: {
          name: ['Alice'],
          url: ['https://alice.example/'],
          photo: ['https://alice.example/photo.jpg'],
        },
      },
    ],
    location: [
      {
        type: ['h-adr'],
        properties: { locality: ['Las Vegas'], latitude: ['36.17'] },
      },
    ],
    'custom-property': ['first', { value: 'second', extra: ['kept'] }],
    'post-status': ['draft'],
  };
  const entry = await parseMicropubCreateRequest(
    micropubRequest({ type: ['h-entry'], properties })
  );
  const file = buildMicropubWritingFile(entry, 'nested-draft');
  const data = matter(file, {}).data;
  assert.equal(data.draft, true);
  assert.equal(data.contentFormat, 'text');
  const returned = micropubSource(
    file,
    `${site.origin}/writings/nested-draft`
  ).properties;
  for (const [key, values] of Object.entries(properties))
    assert.deepEqual(returned[key], values, key);
});

test('Micropub accepts contentless reactions, audio, video, and events', async () => {
  for (const [properties, type, mf2Type] of [
    [{ 'like-of': ['https://example.com/like'] }, 'like', 'h-entry'],
    [{ 'repost-of': ['https://example.com/repost'] }, 'repost', 'h-entry'],
    [
      { 'bookmark-of': ['https://example.com/bookmark'] },
      'bookmark',
      'h-entry',
    ],
    [
      { 'in-reply-to': ['https://example.com/event'], rsvp: ['yes'] },
      'rsvp',
      'h-entry',
    ],
    [{ audio: ['https://example.com/audio.mp3'] }, 'audio', 'h-entry'],
    [{ video: ['https://example.com/video.mp4'] }, 'video', 'h-entry'],
    [
      {
        name: ['Transit picnic'],
        start: ['2026-10-10T12:00:00-07:00'],
        end: ['2026-10-10T14:00:00-07:00'],
        location: ['geo:36.17,-115.14'],
      },
      'event',
      'h-event',
    ],
  ] as const) {
    const entry = await parseMicropubCreateRequest(
      micropubRequest({ type: [mf2Type], properties })
    );
    assert.equal(entry.postType, type);
    assert.equal(entry.content, '');
    const roundTrip = micropubSource(
      buildMicropubWritingFile(entry, type),
      `${site.origin}/writings/${type}`
    );
    assert.deepEqual(roundTrip.type, [mf2Type]);
    for (const [key, values] of Object.entries(properties))
      assert.deepEqual(roundTrip.properties[key], values);
  }
});

test('Micropub sanitizes HTML content while preserving readable HTML source', async () => {
  const entry = await parseMicropubCreateRequest(
    micropubRequest({
      type: ['h-entry'],
      properties: {
        content: [
          {
            html: '<p>Hello <strong>friend</strong>.</p><script>alert(1)</script><img src="javascript:bad" onerror="bad">',
          },
        ],
      },
    })
  );
  const file = buildMicropubWritingFile(entry, 'html-note');
  assert.equal(matter(file, {}).data.contentFormat, 'html');
  assert.equal(matter(file, {}).data.description, 'Hello friend.');
  const content = micropubSource(file, `${site.origin}/writings/html-note`)
    .properties.content[0] as { html: string };
  assert.match(content.html, /<p>Hello <strong>friend<\/strong>\.<\/p>/);
  assert.doesNotMatch(content.html, /script|javascript|onerror|alert/);
});
