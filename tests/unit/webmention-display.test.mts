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

test('a post with no approved webmentions renders nothing', () => {
  assert.equal(
    renderToStaticMarkup(
      createElement(WebmentionSection, { webmentions: group({}) })
    ),
    ''
  );
});
