import { mf2 } from 'microformats-parser';
import type { MicroformatRoot } from 'microformats-parser/dist/types';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { site } from '@/lib/site';
import type { WritingData } from '@/lib/writings';

// The link component imports its stylesheet, which Next.js bundles and
// plain Node cannot load, so a stylesheet loads as an empty module here.
// Static imports would load before the hook exists, hence the awaits.
registerHooks({
  load(url, context, nextLoad) {
    return url.endsWith('.css')
      ? { format: 'module', source: '', shortCircuit: true }
      : nextLoad(url, context);
  },
});
const { default: ReplyTarget } =
  await import('@/components/writings/ReplyTarget');
const { default: WritingItem } =
  await import('@/components/writings/WritingItem');

const index = `${site.origin}/writings`;

function makeWriting(overrides: Partial<WritingData> = {}): WritingData {
  return {
    slug: 'hello',
    title: 'Hello there.',
    hasExplicitTitle: false,
    description: 'Hello there.',
    published: new Date('2026-09-24T15:00:00Z'),
    lastUpdated: new Date('2026-09-24T15:00:00Z'),
    tags: ['note'],
    people: [],
    draft: false,
    featured: false,
    readingTime: 1,
    postType: 'note',
    ...overrides,
  };
}

/** The entry as a parser reads it from the index, inside the page's h-feed. */
function parseEntry(
  writing: WritingData,
  contentHtml?: string
): MicroformatRoot {
  const html = renderToStaticMarkup(
    createElement(
      'main',
      { className: 'h-feed' },
      createElement(WritingItem, { writing, contentHtml })
    )
  );
  const { items } = mf2(html, { baseUrl: index });
  assert.equal(items.length, 1, 'the entry stays inside the feed');
  const [entry] = items[0].children ?? [];
  assert.deepEqual(entry?.type, ['h-entry']);
  return entry;
}

function cite(entry: MicroformatRoot, property: string): MicroformatRoot {
  const [value] = entry.properties[property] ?? [];
  assert.ok(
    typeof value === 'object' && value !== null && 'type' in value,
    `${property} is an embedded microformat`
  );
  return value as MicroformatRoot;
}

test('a note on the index carries its whole text as e-content', () => {
  const entry = parseEntry(
    makeWriting(),
    '<p>Hello there. The rest of the note.</p>'
  );
  assert.deepEqual(entry.properties.url, [`${site.origin}/writings/hello`]);
  assert.deepEqual(entry.properties.name, ['Hello there.']);
  const [content] = entry.properties.content ?? [];
  assert.ok(typeof content === 'object' && content !== null);
  assert.equal(
    (content as { html: string }).html,
    '<p>Hello there. The rest of the note.</p>'
  );
});

test('an article on the index leaves its content to the permalink', () => {
  const entry = parseEntry(
    makeWriting({
      title: 'A long read',
      hasExplicitTitle: true,
      description: 'What it is about.',
      postType: 'article',
    })
  );
  assert.equal(entry.properties.content, undefined);
  assert.deepEqual(entry.properties.summary, ['What it is about.']);
});

for (const [field, property] of [
  ['inReplyTo', 'in-reply-to'],
  ['likeOf', 'like-of'],
  ['repostOf', 'repost-of'],
  ['bookmarkOf', 'bookmark-of'],
] as const) {
  test(`${field} becomes a u-${property} h-cite like the permalink's`, () => {
    const url = 'https://example.com/posts/1';
    const entry = parseEntry(makeWriting({ [field]: url }));
    const target = cite(entry, property);
    assert.deepEqual(target.type, ['h-cite']);
    assert.deepEqual(target.properties.url, [url]);
  });
}

test('an RSVP answers the event and carries its status on the entry', () => {
  const eventUrl = 'https://example.com/events/1';
  const entry = parseEntry(
    makeWriting({ postType: 'rsvp', rsvp: { eventUrl, status: 'yes' } })
  );
  assert.deepEqual(cite(entry, 'in-reply-to').properties.url, [eventUrl]);
  assert.deepEqual(entry.properties.rsvp, ['yes']);
});

test('photo posts carry each photo as a u-photo', () => {
  const entry = parseEntry(
    makeWriting({
      postType: 'photo',
      photos: [
        { url: 'https://media.example/a.jpg', alt: 'A road.' },
        { url: 'https://media.example/b.jpg' },
      ],
    })
  );
  assert.deepEqual(entry.properties.photo, [
    'https://media.example/a.jpg',
    'https://media.example/b.jpg',
  ]);
});

test('the permalink puts an RSVP on the post, not on the event it cites', () => {
  const eventUrl = 'https://example.com/events/1';
  const html = renderToStaticMarkup(
    createElement(
      'article',
      { className: 'h-entry' },
      createElement(ReplyTarget, {
        url: eventUrl,
        kind: 'rsvp',
        rsvpStatus: 'maybe',
      })
    )
  );
  const [entry] = mf2(html, { baseUrl: `${site.origin}/writings/hello` }).items;
  assert.deepEqual(entry.properties.rsvp, ['maybe']);
  const event = cite(entry, 'in-reply-to');
  assert.deepEqual(event.properties.url, [eventUrl]);
  assert.equal(event.properties.rsvp, undefined);
});
