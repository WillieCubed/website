import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type FeedItem,
  generateActivityAtomFeed,
  generateAtomFeed,
  generateRssFeed,
  generateWritingsAtomFeed,
} from '@/lib/feeds';
import { writingActivityFeedConfig } from '@/lib/indieweb/activity-feed-config';
import { site } from '@/lib/site';

const item: FeedItem = {
  title: 'Original Post',
  description: 'A post.',
  url: `${site.origin}/writings/original-post`,
  published: new Date('2026-05-18T12:00:00Z'),
  updated: new Date('2026-05-20T12:00:00Z'),
};

/** The feed-level element, ignoring any inside an entry. */
function feedElement(xml: string, name: string): string | undefined {
  const head = xml.split('<entry>')[0];
  return new RegExp(`<${name}>(.*?)</${name}>`).exec(head)?.[1];
}

function alternateLink(xml: string): string | undefined {
  const head = xml.split('<entry>')[0];
  return /<link href="([^"]*)" rel="alternate"/.exec(head)?.[1];
}

test('the site Atom feed has a well-formed id', () => {
  const id = feedElement(generateAtomFeed([item]), 'id');

  assert.equal(id, `${site.origin}/feed/atom`);
  assert.doesNotMatch(id ?? '', /[^:]\/\//);
});

test('the site and writings Atom feeds have different ids', () => {
  const siteId = feedElement(generateAtomFeed([item]), 'id');
  const writingsId = feedElement(generateWritingsAtomFeed([item]), 'id');

  assert.equal(writingsId, `${site.origin}/writings/feed/atom`);
  assert.notEqual(siteId, writingsId);
});

test('an activity Atom feed takes its id from its own URL', () => {
  const config = writingActivityFeedConfig('original-post', 'atom');
  const xml = generateActivityAtomFeed([], {
    ...config,
    subtitle: config.description,
  });

  assert.equal(feedElement(xml, 'id'), config.feedUrl);
});

test('a feed with entries reports its newest date as updated', () => {
  assert.equal(
    feedElement(generateAtomFeed([item]), 'updated'),
    '2026-05-20T12:00:00.000Z'
  );
});

test('an empty Atom feed reports when it was built, not 1970', () => {
  const before = Date.now();
  const updated = feedElement(generateAtomFeed([]), 'updated');
  const after = Date.now();

  const time = new Date(updated ?? '').getTime();
  assert.ok(time >= before && time <= after, `updated was ${updated}`);
});

test('an empty RSS feed reports when it was built, not 1970', () => {
  const lastBuildDate = /<lastBuildDate>(.*?)<\/lastBuildDate>/.exec(
    generateRssFeed([])
  )?.[1];

  // RFC 822 dates drop milliseconds, so compare against the whole second.
  const time = new Date(lastBuildDate ?? '').getTime();
  assert.ok(time >= Date.now() - 5_000, `lastBuildDate was ${lastBuildDate}`);
});

test('the writings Atom feed describes and links to the writings page', () => {
  const xml = generateWritingsAtomFeed([item]);

  assert.equal(feedElement(xml, 'title'), 'Willie&apos;s Writings');
  assert.notEqual(feedElement(xml, 'subtitle'), site.description);
  assert.match(feedElement(xml, 'subtitle') ?? '', /software, music/);
  assert.equal(alternateLink(xml), `${site.origin}/writings`);
});

test('the site Atom feed links to the homepage', () => {
  const xml = generateAtomFeed([item]);

  assert.equal(feedElement(xml, 'title'), site.name);
  assert.equal(alternateLink(xml), `${site.origin}/`);
});

test('a writing activity Atom feed links to its writing', () => {
  const config = writingActivityFeedConfig('original-post', 'atom');
  const xml = generateActivityAtomFeed([], {
    ...config,
    subtitle: config.description,
  });

  assert.equal(alternateLink(xml), `${site.origin}/writings/original-post`);
});
