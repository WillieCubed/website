import { mf2 } from 'microformats-parser';
import type { MicroformatRoot } from 'microformats-parser/dist/types';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import WebmentionSection from '@/components/indieweb/WebmentionSection';

import type { Webmention, WebmentionGroup } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

const target = `${site.origin}/writings/indiemark-level-3`;

function mention(overrides: Partial<Webmention>): Webmention {
  return {
    id: crypto.randomUUID(),
    sourceUrl: 'https://example.com/replies/1',
    targetUrl: target,
    type: 'reply',
    author: {},
    receivedAt: new Date('2026-09-20T12:00:00Z'),
    isVerified: true,
    isApproved: true,
    ...overrides,
  };
}

function group(overrides: Partial<WebmentionGroup>): WebmentionGroup {
  return {
    likes: [],
    reposts: [],
    replies: [],
    mentions: [],
    bookmarks: [],
    rsvps: [],
    ...overrides,
  };
}

/** Render the section inside a post's h-entry and parse it as a consumer would. */
function parsePost(webmentions: WebmentionGroup): MicroformatRoot {
  const html = renderToStaticMarkup(
    createElement(
      'article',
      { className: 'h-entry' },
      createElement('a', { className: 'u-url', href: target }, 'Post'),
      createElement(WebmentionSection, { webmentions })
    )
  );
  const { items } = mf2(html, { baseUrl: target });
  assert.equal(items.length, 1);
  return items[0];
}

function cite(value: unknown): MicroformatRoot {
  assert.ok(typeof value === 'object' && value !== null && 'type' in value);
  const root = value as MicroformatRoot;
  assert.deepEqual(root.type, ['h-cite']);
  return root;
}

test('a reply from another site renders as an h-cite comment on the post', () => {
  const entry = parsePost(
    group({
      replies: [
        mention({
          sourceUrl: 'https://alice.example/notes/42',
          author: {
            name: 'Alice',
            url: 'https://alice.example/',
            photo: 'https://alice.example/me.jpg',
          },
          content: 'Congrats on level three!',
          publishedAt: new Date('2026-09-21T15:30:00Z'),
        }),
      ],
    })
  );

  const comments = entry.properties.comment ?? [];
  assert.equal(comments.length, 1);
  const comment = cite(comments[0]);
  assert.deepEqual(comment.properties.url, ['https://alice.example/notes/42']);
  assert.deepEqual(comment.properties.content, ['Congrats on level three!']);
  assert.deepEqual(comment.properties.published, ['2026-09-21T15:30:00.000Z']);

  const author = comment.properties.author?.[0] as MicroformatRoot;
  assert.deepEqual(author.type, ['h-card']);
  assert.deepEqual(author.properties.name, ['Alice']);
  assert.deepEqual(author.properties.url, ['https://alice.example/']);
  assert.deepEqual(author.properties.photo, [
    { value: 'https://alice.example/me.jpg', alt: 'Alice' },
  ]);
});

test('a reply with no date or author still cites its source', () => {
  const entry = parsePost(
    group({ replies: [mention({ content: 'Nice.', author: {} })] })
  );
  const comment = cite(entry.properties.comment?.[0]);
  assert.deepEqual(comment.properties.url, ['https://example.com/replies/1']);
  assert.equal(comment.properties.published, undefined);
});

test('likes and reposts render as facepiles of h-cites under their own properties', () => {
  const entry = parsePost(
    group({
      likes: [
        mention({
          type: 'like',
          sourceUrl: 'https://bob.example/likes/1',
          author: { name: 'Bob', url: 'https://bob.example/' },
        }),
        mention({
          type: 'like',
          sourceUrl: 'https://carol.example/likes/7',
          author: { name: 'Carol' },
        }),
      ],
      reposts: [
        mention({
          type: 'repost',
          sourceUrl: 'https://dan.example/reposts/3',
          author: { name: 'Dan', url: 'https://dan.example/' },
        }),
      ],
    })
  );

  const likes = (entry.properties.like ?? []).map(cite);
  assert.deepEqual(
    likes.map((like) => like.properties.url?.[0]),
    ['https://bob.example/likes/1', 'https://carol.example/likes/7']
  );
  assert.deepEqual(
    likes.map(
      (like) => (like.properties.author?.[0] as MicroformatRoot).properties.name
    ),
    [['Bob'], ['Carol']]
  );

  const reposts = (entry.properties.repost ?? []).map(cite);
  assert.deepEqual(
    reposts.map((repost) => repost.properties.url?.[0]),
    ['https://dan.example/reposts/3']
  );
  assert.equal(entry.properties.comment, undefined);
});

test('the names line says who reacted, so nothing sits only behind a hover', () => {
  const html = renderToStaticMarkup(
    createElement(WebmentionSection, {
      webmentions: group({
        likes: ['Bob', 'Carol', 'Dan', 'Eve'].map((name) =>
          mention({ type: 'like', author: { name } })
        ),
        reposts: [mention({ type: 'repost', author: { name: 'Fay' } })],
      }),
    })
  );
  assert.match(html, /Liked by Bob, Carol, and 2 others/);
  assert.match(html, /Reposted by Fay/);
});

test('RSVPs render as u-rsvp h-cites that keep their answer, grouped by it', () => {
  const rsvp = (name: string, answer: 'yes' | 'no' | 'maybe' | 'interested') =>
    mention({
      type: 'rsvp',
      rsvp: answer,
      sourceUrl: `https://${name.toLowerCase()}.example/rsvp`,
      author: { name, url: `https://${name.toLowerCase()}.example/` },
    });
  const webmentions = group({
    rsvps: [
      rsvp('Ada', 'yes'),
      rsvp('Bea', 'yes'),
      rsvp('Cy', 'maybe'),
      rsvp('Di', 'interested'),
      rsvp('Ed', 'no'),
    ],
  });

  const entry = parsePost(webmentions);
  const cites = (entry.properties.rsvp ?? []).map(cite);
  assert.deepEqual(
    cites.map((item) => [
      item.properties.url?.[0],
      item.properties.rsvp?.[0],
      (item.properties.author?.[0] as MicroformatRoot).properties.name?.[0],
    ]),
    [
      ['https://ada.example/rsvp', 'yes', 'Ada'],
      ['https://bea.example/rsvp', 'yes', 'Bea'],
      ['https://cy.example/rsvp', 'maybe', 'Cy'],
      ['https://di.example/rsvp', 'interested', 'Di'],
    ]
  );

  const html = renderToStaticMarkup(
    createElement(WebmentionSection, { webmentions })
  );
  assert.match(html, /Ada and Bea are going/);
  assert.match(html, /Cy might go/);
  assert.match(html, /Di is interested/);
  assert.doesNotMatch(html, /ed\.example/);
});

test('a post whose only RSVPs declined renders nothing', () => {
  assert.equal(
    renderToStaticMarkup(
      createElement(WebmentionSection, {
        webmentions: group({
          rsvps: [
            mention({ type: 'rsvp', rsvp: 'no', author: { name: 'Ed' } }),
          ],
        }),
      })
    ),
    ''
  );
});

test('a mention renders as a u-mention h-cite with its title, author, and date', () => {
  const entry = parsePost(
    group({
      mentions: [
        mention({
          type: 'mention',
          sourceUrl: 'https://gil.example/2026/transit-roundup',
          name: 'Transit roundup, week 38',
          content: 'This week in buses…',
          author: {
            name: 'Gil',
            url: 'https://gil.example/',
            photo: 'https://gil.example/me.jpg',
          },
          publishedAt: new Date('2026-09-22T09:00:00Z'),
        }),
      ],
    })
  );

  const [item] = (entry.properties.mention ?? []).map(cite);
  assert.deepEqual(item.properties.url, [
    'https://gil.example/2026/transit-roundup',
  ]);
  assert.deepEqual(item.properties.name, ['Transit roundup, week 38']);
  assert.deepEqual(item.properties.published, ['2026-09-22T09:00:00.000Z']);
  const author = item.properties.author?.[0] as MicroformatRoot;
  assert.deepEqual(author.properties.name, ['Gil']);
  assert.deepEqual(author.properties.url, ['https://gil.example/']);
  assert.deepEqual(author.properties.photo, ['https://gil.example/me.jpg']);
});

test('a mention without a title shows the start of its text, and its host without an author', () => {
  const long = `${'word '.repeat(60)}end`;
  const html = renderToStaticMarkup(
    createElement(WebmentionSection, {
      webmentions: group({
        mentions: [
          mention({
            type: 'mention',
            sourceUrl: 'https://hal.example/notes/9',
            content: long,
          }),
          mention({
            type: 'mention',
            sourceUrl: 'https://ivy.example/links',
          }),
        ],
      }),
    })
  );
  const { items } = mf2(html, { baseUrl: target });
  const [note, bare] = items.map(cite);
  const [text] = note.properties.content as string[];
  assert.ok(text.endsWith('…'));
  assert.ok(text.length <= 141, 'the excerpt is cut short');
  assert.equal(note.properties.name, undefined);
  assert.equal(bare.properties.author, undefined);
  assert.match(html, />hal\.example</);
  assert.match(html, />ivy\.example<\/a>/);
});

test('a post with no approved webmentions renders nothing', () => {
  assert.equal(
    renderToStaticMarkup(
      createElement(WebmentionSection, { webmentions: group({}) })
    ),
    ''
  );
});
