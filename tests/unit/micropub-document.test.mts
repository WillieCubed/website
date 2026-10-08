import matter from 'gray-matter';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMicropubWritingFile,
  parseMicropubCreateRequest,
} from '@/lib/indieweb/micropub';
import {
  MicropubRequestError,
  type MicropubUpdate,
  applyMicropubUpdate,
  micropubSource,
  siteTimestamp,
} from '@/lib/indieweb/micropub-document';
import { site } from '@/lib/site';

const handWritten = `---
# A comment the author left.
title: 'Transit notes'
description: Why the 109 needs a bus lane.
published: 2026-09-20T08:00-0700
lastUpdated: 2026-09-21T09:30-0700
tags: [transit, las-vegas]
draft: true
featured: true
series:
  slug: superbloom
  part: 2
people:
  - name: Jane Doe
    url: https://janedoe.example/
syndication:
  - name: Instagram
    url: https://instagram.com/p/abc
photo:
  - url: https://example.blob.vercel-storage.com/media/bus.jpg
    alt: A bus at dusk
---

The 109 carries more riders than any other route.

## Why

Because it runs every fifteen minutes.
`;

const url = `${site.origin}/writings/transit-notes`;

test('micropubSource maps frontmatter and body to h-entry properties', () => {
  assert.deepEqual(micropubSource(handWritten, url), {
    type: ['h-entry'],
    properties: {
      name: ['Transit notes'],
      summary: ['Why the 109 needs a bus lane.'],
      content: [
        'The 109 carries more riders than any other route.\n\n## Why\n\nBecause it runs every fifteen minutes.',
      ],
      published: ['2026-09-20T15:00:00.000Z'],
      updated: ['2026-09-21T16:30:00.000Z'],
      category: [
        'transit',
        'las-vegas',
        {
          type: ['h-card'],
          properties: {
            name: ['Jane Doe'],
            url: ['https://janedoe.example/'],
          },
        },
      ],
      photo: [
        {
          value: 'https://example.blob.vercel-storage.com/media/bus.jpg',
          alt: 'A bus at dusk',
        },
      ],
      syndication: ['https://instagram.com/p/abc'],
      'post-status': ['draft'],
      url: [url],
    },
  });
});

test('micropubSource returns only the requested properties, without type', () => {
  const all = micropubSource(handWritten, url).properties;
  assert.deepEqual(
    micropubSource(handWritten, url, [
      'content',
      'category',
      'location',
      'constructor',
    ]),
    { properties: { content: all.content, category: all.category } }
  );
});

test('source editing preserves declared HTML without canonical Micropub metadata', () => {
  const source =
    '---\ntitle: HTML post\ncontentFormat: html\n---\n\n<p>A <strong>formatted</strong> post.</p>\n';
  const edited = applyMicropubUpdate(
    source,
    update({ replace: { summary: ['New summary.'] } }),
    now
  );
  assert.equal(frontmatterOf(edited).contentFormat, 'html');
  assert.deepEqual(micropubSource(edited, url).properties.content, [
    { html: '<p>A <strong>formatted</strong> post.</p>' },
  ]);
});

test('micropubSource reads interaction posts and a timestamp the create path wrote', () => {
  const rsvp = `---
title: "RSVP from 2026-09-23"
published: 2026-09-23T18:51:00.000Z
postType: "rsvp"
inReplyTo: "https://example.com/event"
rsvp:
  eventUrl: "https://example.com/event"
  status: "maybe"
---

Maybe!
`;
  const { properties } = micropubSource(rsvp, url);
  assert.deepEqual(properties.published, ['2026-09-23T18:51:00.000Z']);
  assert.deepEqual(properties['in-reply-to'], ['https://example.com/event']);
  assert.deepEqual(properties.rsvp, ['maybe']);
  assert.deepEqual(properties['post-status'], ['published']);
  assert.equal(properties.updated, undefined);

  const like = `---
published: 2026-09-23T18:51-0700
likeOf: https://example.com/liked
photo:
  - https://example.com/a.jpg
---
`;
  const liked = micropubSource(like, url).properties;
  assert.deepEqual(liked['like-of'], ['https://example.com/liked']);
  assert.deepEqual(liked.photo, ['https://example.com/a.jpg']);
  assert.equal(liked.name, undefined);
  assert.equal(liked.content, undefined);
});

const now = new Date('2026-09-27T20:05:00Z');

function update(parts: Partial<MicropubUpdate>): MicropubUpdate {
  return {
    replace: {},
    add: {},
    deleteProperties: [],
    deleteValues: {},
    ...parts,
  };
}

function frontmatterOf(source: string): Record<string, unknown> {
  return matter(source, {}).data;
}

test('replacing content keeps author metadata and records literal text', () => {
  const result = applyMicropubUpdate(
    handWritten,
    update({ replace: { content: ['A shorter note about the 109.'] } }),
    now
  );

  assert.equal(
    matter(result, {}).content.trim(),
    'A shorter note about the 109.'
  );
  const data = frontmatterOf(result);
  assert.equal(data.contentFormat, 'text');
  assert.equal(data.lastUpdated, '2026-09-27T13:05-0700');
  assert.deepEqual(data.series, frontmatterOf(handWritten).series);
  assert.deepEqual(data.people, frontmatterOf(handWritten).people);
  assert.match(result, /# A comment the author left\./);
  assert.equal(frontmatterOf(result).draft, true);
});

test('an edit keeps CRLF line endings and untouched keys byte for byte', () => {
  const crlf = handWritten.replace(/\n/g, '\r\n');
  const result = applyMicropubUpdate(
    crlf,
    update({ replace: { name: ['Transit notes, revised'] } }),
    now
  );

  assert.equal(matter(result, {}).content, matter(crlf, {}).content);
  assert.equal(frontmatterOf(result).title, 'Transit notes, revised');
  assert.deepEqual(frontmatterOf(result).series, frontmatterOf(crlf).series);
  assert.ok(result.includes('series:\r\n  slug: superbloom\r\n  part: 2\r\n'));
  assert.doesNotMatch(result, /(?<!\r)\n/);
});

test('add and delete edit category values and keep the body', () => {
  const added = applyMicropubUpdate(
    handWritten,
    update({
      add: { category: ['bus', 'transit'] },
      deleteValues: { category: ['las-vegas'] },
    }),
    now
  );

  assert.match(added, /\ntags: \["transit","bus"\]\n/);
  assert.ok(
    added.endsWith(handWritten.slice(handWritten.lastIndexOf('\n---\n')))
  );
  assert.match(added, /\npeople:\n {2}- name: Jane Doe\n/);
});

test('category h-cards add and remove person tags', () => {
  const result = applyMicropubUpdate(
    handWritten,
    update({
      add: {
        category: [
          {
            type: ['h-card'],
            properties: { name: ['Sam Rider'], url: ['https://sam.example/'] },
          },
        ],
      },
      deleteValues: { category: ['https://janedoe.example/'] },
    }),
    now
  );

  assert.deepEqual(frontmatterOf(result).people, [
    { name: 'Sam Rider', url: 'https://sam.example/' },
  ]);
  assert.match(result, /\ntags: \[transit, las-vegas\]\n/);
});

test('deleting whole properties removes their keys', () => {
  const result = applyMicropubUpdate(
    handWritten,
    update({ deleteProperties: ['syndication', 'photo', 'summary'] }),
    now
  );

  assert.doesNotMatch(result, /\nsyndication:|\nphoto:|\ndescription:/);
  assert.match(result, /\nseries:\n {2}slug: superbloom\n {2}part: 2\n/);
  assert.match(result, /# A comment the author left\./);
});

test('added syndication links keep existing names and name known services', () => {
  const result = applyMicropubUpdate(
    handWritten,
    update({
      add: {
        syndication: ['https://bsky.app/profile/alice.example/post/3abc'],
      },
    }),
    now
  );

  assert.deepEqual(frontmatterOf(result).syndication, [
    { name: 'Instagram', url: 'https://instagram.com/p/abc' },
    {
      name: 'Bluesky',
      url: 'https://bsky.app/profile/alice.example/post/3abc',
    },
  ]);
});

test('a draft publishes only when post-status is replaced with published', () => {
  const edited = applyMicropubUpdate(
    handWritten,
    update({
      replace: { name: ['Transit notes, revised'] },
      add: { category: ['bus'] },
      deleteProperties: ['photo'],
    }),
    now
  );
  assert.equal(frontmatterOf(edited).draft, true);

  const published = applyMicropubUpdate(
    handWritten,
    update({ replace: { 'post-status': ['published'] } }),
    now
  );
  assert.match(published, /\ndraft: false\n/);
  assert.equal(frontmatterOf(published).draft, false);

  const refused: Partial<MicropubUpdate>[] = [
    { add: { 'post-status': ['published'] } },
    { deleteProperties: ['post-status'] },
    { replace: { 'post-status': ['scheduled'] } },
  ];
  for (const parts of refused) {
    assert.throws(
      () => applyMicropubUpdate(handWritten, update(parts), now),
      MicropubRequestError,
      JSON.stringify(parts)
    );
  }
});

test('an update that changes nothing returns the file untouched', () => {
  assert.equal(
    applyMicropubUpdate(
      handWritten,
      update({
        add: { category: ['transit'] },
        replace: { 'post-status': ['draft'] },
        deleteValues: { syndication: ['https://elsewhere.example/'] },
      }),
      now
    ),
    handWritten
  );
});

test('replacing published writes the site-local time', () => {
  const result = applyMicropubUpdate(
    handWritten,
    update({ replace: { published: ['2026-09-19T16:00:00Z'] } }),
    now
  );
  assert.match(result, /\npublished: 2026-09-19T09:00-0700\n/);
  assert.match(result, /\nlastUpdated: 2026-09-27T13:05-0700\n/);
});

test('updates the frontmatter cannot hold are refused', () => {
  const refused: Partial<MicropubUpdate>[] = [
    { replace: { updated: ['2026-09-21T09:30:00-07:00'] } },
    { replace: { url: ['https://example.com/'] } },

    { replace: { 'like-of': ['javascript:alert(1)'] } },

    { replace: { published: ['not a date'] } },
    { replace: { start: ['not a date'] } },
    { replace: { end: ['not a date'] } },
    { deleteProperties: ['published'] },
    { replace: { rsvp: ['yes'] } },
    { add: { category: [{ type: ['h-card'], properties: { name: ['?'] } }] } },
    {},
  ];
  for (const parts of refused) {
    assert.throws(
      () => applyMicropubUpdate(handWritten, update(parts), now),
      MicropubRequestError,
      JSON.stringify(parts)
    );
  }
});

test('a photo update needs alt text before it can produce a new file', () => {
  for (const photo of [
    'https://example.com/photo.jpg',
    { value: 'https://example.com/photo.jpg', alt: '   ' },
  ]) {
    assert.throws(
      () =>
        applyMicropubUpdate(
          handWritten,
          update({ replace: { photo: [photo] } }),
          now
        ),
      (error: unknown) =>
        error instanceof MicropubRequestError &&
        /Photo 1 needs nonblank alt text/.test(error.description)
    );
  }
  assert.match(
    applyMicropubUpdate(
      handWritten,
      update({
        replace: {
          photo: [
            { value: 'https://example.com/photo.jpg', alt: 'A bus at dusk' },
          ],
        },
      }),
      now
    ),
    /alt: "A bus at dusk"/
  );
});

test('siteTimestamp writes the site-local time with its offset', () => {
  assert.equal(siteTimestamp(now), '2026-09-27T13:05-0700');
  assert.equal(
    siteTimestamp(new Date('2026-01-15T20:00:09Z')),
    '2026-01-15T12:00:09-0800'
  );
  assert.equal(new Date(siteTimestamp(now)).toISOString(), now.toISOString());
});

test('generic nested values survive replace, add, value deletion, and source filtering', () => {
  const nested = {
    type: ['h-cite'],
    properties: {
      url: ['https://example.com/post'],
      name: ['Nested title'],
      author: [
        {
          type: ['h-card'],
          properties: { name: ['Alice'], url: ['https://alice.example/'] },
        },
      ],
    },
  };
  const replaced = applyMicropubUpdate(
    handWritten,
    update({
      replace: {
        'in-reply-to': [nested, 'https://example.com/another'],
        location: [
          { type: ['h-adr'], properties: { locality: ['Las Vegas'] } },
        ],
        'custom-property': ['first'],
      },
    }),
    now
  );
  const added = applyMicropubUpdate(
    replaced,
    update({
      add: { 'custom-property': ['second', { value: 'third', nested }] },
      deleteValues: { 'in-reply-to': ['https://example.com/another'] },
    }),
    now
  );
  const filtered = micropubSource(added, url, [
    'in-reply-to',
    'custom-property',
    'location',
  ]);
  assert.deepEqual(filtered.properties['in-reply-to'], [nested]);
  assert.deepEqual(filtered.properties['custom-property'], [
    'first',
    'second',
    { value: 'third', nested },
  ]);
  assert.deepEqual(filtered.properties.location, [
    { type: ['h-adr'], properties: { locality: ['Las Vegas'] } },
  ]);
  const removed = applyMicropubUpdate(
    added,
    update({ deleteProperties: ['custom-property'] }),
    now
  );
  assert.equal(
    micropubSource(removed, url).properties['custom-property'],
    undefined
  );
});

test('generic values with the same URL or value retain their distinct nested data', () => {
  const first = { value: 'same', nested: { label: 'first' } };
  const second = { value: 'same', nested: { label: 'second' } };
  const replaced = applyMicropubUpdate(
    handWritten,
    update({ replace: { 'custom-property': [first] } }),
    now
  );
  const added = applyMicropubUpdate(
    replaced,
    update({ add: { 'custom-property': [second] } }),
    now
  );
  assert.deepEqual(micropubSource(added, url).properties['custom-property'], [
    first,
    second,
  ]);
  const removed = applyMicropubUpdate(
    added,
    update({ deleteValues: { 'custom-property': [first] } }),
    now
  );
  assert.deepEqual(micropubSource(removed, url).properties['custom-property'], [
    second,
  ]);
});

test('updates project media and reaction types while preserving ATProto metadata', async () => {
  const entry = await parseMicropubCreateRequest(
    new Request(site.origin + '/micropub', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ properties: { content: ['A note.'] } }),
    })
  );
  const source = buildMicropubWritingFile(entry, 'type-update').replace(
    '---\n',
    '---\natproto: {uri: "at://did:plc:owner/app.bsky.feed.post/record"}\n'
  );
  const video = applyMicropubUpdate(
    source,
    update({ add: { video: ['https://example.com/video.mp4'] } }),
    now
  );
  assert.equal(frontmatterOf(video).postType, 'video');
  const like = applyMicropubUpdate(
    video,
    update({ add: { 'like-of': ['https://example.com/post'] } }),
    now
  );
  assert.equal(frontmatterOf(like).postType, 'like');
  const note = applyMicropubUpdate(
    like,
    update({ deleteProperties: ['like-of', 'video'] }),
    now
  );
  assert.equal(frontmatterOf(note).postType, 'note');
  assert.deepEqual(frontmatterOf(note).atproto, frontmatterOf(source).atproto);
});

test('syndication intent updates validate targets and remove the projected selection', () => {
  const previous = process.env.ATPROTO_APP_PASSWORD;
  process.env.ATPROTO_APP_PASSWORD = 'test-password';
  try {
    const target = site.syndication.find(
      (account) => account.service === 'Bluesky'
    )!.profile;
    const selected = applyMicropubUpdate(
      handWritten,
      update({ replace: { 'mp-syndicate-to': [target] } }),
      now
    );
    assert.deepEqual(frontmatterOf(selected).syndicateTo, [target]);
    const removed = applyMicropubUpdate(
      selected,
      update({ deleteProperties: ['mp-syndicate-to'] }),
      now
    );
    assert.equal(frontmatterOf(removed).syndicateTo, undefined);
    assert.equal(
      micropubSource(removed, url).properties['mp-syndicate-to'],
      undefined
    );
    assert.throws(() =>
      applyMicropubUpdate(
        selected,
        update({
          replace: { 'mp-syndicate-to': ['https://invalid.example/'] },
        }),
        now
      )
    );
  } finally {
    if (previous === undefined) delete process.env.ATPROTO_APP_PASSWORD;
    else process.env.ATPROTO_APP_PASSWORD = previous;
  }
});
