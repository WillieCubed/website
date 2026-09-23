import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  type FeedItem,
  generateActivityAtomFeed,
  generateAtomFeed,
  generateJsonFeed,
  generateRssFeed,
  generateWritingsAtomFeed,
} from '@/lib/feeds';
import { writingActivityFeedConfig } from '@/lib/indieweb/activity-feed-config';
import { WEBSUB_HUB } from '@/lib/indieweb/constants';
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

test('the generated RSS, Atom, and JSON feeds declare the WebSub hub', () => {
  assert.ok(
    generateRssFeed([item]).includes(
      `<atom:link href="${WEBSUB_HUB}" rel="hub"/>`
    )
  );
  assert.ok(
    generateAtomFeed([item]).includes(`<link href="${WEBSUB_HUB}" rel="hub"/>`)
  );
  assert.deepEqual(JSON.parse(generateJsonFeed([item])).hubs, [
    { type: 'WebSub', url: WEBSUB_HUB },
  ]);
});

/** Every route handler under a `feed` or `feed.xml` directory in `app/`. */
async function feedRoutes(directory = path.join(process.cwd(), 'app')) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<string[]> => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return feedRoutes(target);
      return entry.name === 'route.ts' && /\/feed(?:\.xml)?\//.test(target)
        ? [target]
        : [];
    })
  );
  return files.flat();
}

test('the routes that build RSS with the rss package declare WEBSUB_HUB', async () => {
  const routes = await feedRoutes();
  const rssPackageRoutes: string[] = [];

  for (const route of routes) {
    const source = await readFile(route, 'utf8');
    // The hub URL lives in lib/indieweb/constants.ts and nowhere else.
    assert.ok(!source.includes(new URL(WEBSUB_HUB).host), route);
    if (!source.includes('new RSS(')) continue;
    rssPackageRoutes.push(path.relative(process.cwd(), route));
    assert.match(source, /\bhub: WEBSUB_HUB\b/, route);
  }

  assert.deepEqual(rssPackageRoutes.sort(), [
    'app/feed.xml/route.ts',
    'app/writings/feed.xml/route.ts',
  ]);
});
