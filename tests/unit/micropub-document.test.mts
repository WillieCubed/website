import matter from 'gray-matter';
import assert from 'node:assert/strict';
import test from 'node:test';

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

test('replacing content rewrites the body and lastUpdated and nothing else', () => {
  const result = applyMicropubUpdate(
    handWritten,
    update({ replace: { content: ['A shorter note about the 109.'] } }),
    now
  );

  assert.equal(
    result,
    handWritten
      .replace(
        'lastUpdated: 2026-09-21T09:30-0700',
        'lastUpdated: 2026-09-27T13:05-0700'
      )
      .replace(/\n---\n[\s\S]*$/, '\n---\n\nA shorter note about the 109.\n')
  );
  assert.equal(frontmatterOf(result).draft, true);
});

test('an edit keeps CRLF line endings and untouched keys byte for byte', () => {
  const crlf = handWritten.replace(/\n/g, '\r\n');
  const result = applyMicropubUpdate(
    crlf,
    update({ replace: { name: ['Transit notes, revised'] } }),
    now
  );

  assert.equal(
    result,
    crlf
      .replace("title: 'Transit notes'", 'title: "Transit notes, revised"')
      .replace(
        'lastUpdated: 2026-09-21T09:30-0700',
        'lastUpdated: 2026-09-27T13:05-0700'
      )
  );
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
        syndication: ['https://bsky.app/profile/willie.page/post/3abc'],
      },
    }),
    now
  );

  assert.deepEqual(frontmatterOf(result).syndication, [
    { name: 'Instagram', url: 'https://instagram.com/p/abc' },
    {
      name: 'Bluesky',
      url: 'https://bsky.app/profile/willie.page/post/3abc',
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
    { replace: { location: ['geo:36.17,-115.14'] } },
    { replace: { updated: ['2026-09-21T09:30:00-07:00'] } },
    { replace: { url: ['https://example.com/'] } },
    { replace: { 'like-of': ['https://a.example/', 'https://b.example/'] } },
    { replace: { 'like-of': ['javascript:alert(1)'] } },
    { replace: { content: [{ html: '<p>Hi</p>' }] } },
    { replace: { published: ['not a date'] } },
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
