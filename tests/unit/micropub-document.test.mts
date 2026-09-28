import assert from 'node:assert/strict';
import test from 'node:test';

import { micropubSource } from '@/lib/indieweb/micropub-document';
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
