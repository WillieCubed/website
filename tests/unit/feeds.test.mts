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
  generateWritingsJsonFeed,
  generateWritingsRssFeed,
  initiativeToFeedItem,
} from '@/lib/feeds';
import { renderFeedHtml } from '@/lib/feeds/html';
import { writingActivityFeedConfig } from '@/lib/indieweb/activity-feed-config';
import { WEBSUB_HUB } from '@/lib/indieweb/constants';
import type { Initiative } from '@/lib/initiatives';
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

test('no feed route writes its own XML or names the hub', async () => {
  const routes = await feedRoutes();
  assert.ok(routes.length >= 12, `found only ${routes.length} feed routes`);

  for (const route of routes) {
    const source = await readFile(route, 'utf8');
    // The hub URL lives in lib/indieweb/constants.ts and nowhere else.
    assert.ok(!source.includes(new URL(WEBSUB_HUB).host), route);
    assert.doesNotMatch(source, /<\?xml|from 'rss'/, route);
  }
});

test('the site and writings feeds come from lib/feeds and are cached', async () => {
  // Activity feeds go through lib/indieweb/activity-feed-route.ts instead.
  const routes = (await feedRoutes()).filter(
    (route) => !route.includes(`${path.sep}activity${path.sep}`)
  );
  assert.equal(routes.length, 6);

  for (const route of routes) {
    const source = await readFile(route, 'utf8');
    assert.match(source, /from '@\/lib\/feeds'/, route);
    assert.match(source, /from '@\/lib\/feeds\/items'/, route);
    assert.match(source, /'use cache';\s+cacheLife\('hours'\);/, route);
  }
});

const full: FeedItem = {
  ...item,
  content: '<p>The <em>whole</em> post &amp; more.</p>',
};

test('RSS items carry their full content as content:encoded', () => {
  const xml = generateRssFeed([full]);

  assert.match(
    xml,
    /xmlns:content="http:\/\/purl\.org\/rss\/1\.0\/modules\/content\/"/
  );
  assert.ok(
    xml.includes(
      '<content:encoded>&lt;p&gt;The &lt;em&gt;whole&lt;/em&gt; post &amp;amp; more.&lt;/p&gt;</content:encoded>'
    )
  );
  assert.equal(xml.match(/rel="self"/g)?.length, 1);
});

test('Atom entries carry their full content as HTML', () => {
  assert.ok(
    generateAtomFeed([full]).includes(
      '<content type="html">&lt;p&gt;The &lt;em&gt;whole&lt;/em&gt; post &amp;amp; more.&lt;/p&gt;</content>'
    )
  );
});

test('JSON Feed items carry their full content as content_html', () => {
  const [entry] = JSON.parse(generateJsonFeed([full])).items;

  assert.equal(entry.content_html, full.content);
  assert.equal(entry.summary, full.description);
});

test('an item without content leaves the content element out', () => {
  assert.doesNotMatch(generateRssFeed([item]), /<content:encoded>/);
  assert.doesNotMatch(generateAtomFeed([item]), /<content /);
});

test('the writings RSS and JSON feeds describe and link to the writings page', () => {
  const rss = generateWritingsRssFeed([item]);
  assert.match(rss, /<title>Willie&apos;s Writings<\/title>/);
  assert.match(rss, new RegExp(`<link>${site.origin}/writings</link>`));
  assert.match(
    rss,
    new RegExp(`<atom:link href="${site.origin}/writings/feed.xml" rel="self"`)
  );

  const json = JSON.parse(generateWritingsJsonFeed([item]));
  assert.equal(json.title, "Willie's Writings");
  assert.equal(json.home_page_url, `${site.origin}/writings`);
  assert.equal(json.feed_url, `${site.origin}/writings/feed/json`);
});

const initiative = {
  title: 'Fall Tour 2026',
  description: 'A four-part campaign.',
  href: '/initiatives/fall-tour-2026',
  starts: new Date(2026, 8, 18),
  updated: new Date(2026, 8, 20),
} as Initiative;

test('an initiative becomes a feed item dated by when it starts', () => {
  const feedItem = initiativeToFeedItem(initiative, '<p>Body</p>');

  assert.equal(feedItem?.url, `${site.origin}/initiatives/fall-tour-2026`);
  assert.equal(feedItem?.published, initiative.starts);
  assert.equal(feedItem?.updated, initiative.updated);
  assert.equal(feedItem?.content, '<p>Body</p>');
});

test('an initiative with no date stays out of the feeds', () => {
  assert.equal(
    initiativeToFeedItem({
      ...initiative,
      starts: undefined,
      updated: undefined,
    }),
    null
  );
});

test('feed HTML renders markdown with absolute site URLs', async () => {
  const html = await renderFeedHtml(
    'Read [the writings](/writings) and *more*.\n\n![A cover](/assets/cover.png)'
  );

  assert.match(
    html,
    new RegExp(`<a href="${site.origin}/writings">the writings</a>`)
  );
  assert.match(html, /<em>more<\/em>/);
  assert.match(
    html,
    new RegExp(`<img src="${site.origin}/assets/cover.png" alt="A cover">`)
  );
});

test('feed HTML turns MDX components into plain HTML', async () => {
  const html = await renderFeedHtml(
    [
      "import Thing from './thing'",
      '<Callout type="info" title="Heads up">\n\nThe body.\n\n</Callout>',
      'Like <Ref href="https://example.org" title="Example">a thing</Ref>.',
      '<SpotifyEmbed url="https://open.spotify.com/track/abc" />',
      '<YouTube videoId="xyz" title="The trailer" />',
      '<Scene src="/a.jpg" alt="A scene" caption="The caption">\n\nAfter.\n\n</Scene>',
      '<RouteMap title="Route" />',
      'Total: {1 + 1}',
    ].join('\n\n')
  );

  assert.doesNotMatch(html, /import|Thing|RouteMap|\{1 \+ 1\}/);
  assert.match(
    html,
    /<aside><p><strong>Heads up<\/strong><\/p>\s*<p>The body\.<\/p><\/aside>/
  );
  assert.match(html, /<a href="https:\/\/example\.org">a thing<\/a>/);
  assert.match(
    html,
    /<a href="https:\/\/open\.spotify\.com\/track\/abc">Listen on Spotify<\/a>/
  );
  assert.match(
    html,
    /<a href="https:\/\/www\.youtube\.com\/watch\?v=xyz">The trailer<\/a>/
  );
  assert.match(
    html,
    new RegExp(
      `<figure><img src="${site.origin}/a.jpg" alt="A scene"><figcaption>The caption</figcaption></figure>`
    )
  );
  assert.match(html, /<p>After\.<\/p>/);
});

test('feed HTML links @mentions but not inside a Ref', async () => {
  const html = await renderFeedHtml(
    'Follow @thewilliediaries and <Ref href="https://example.org">@someone</Ref>.'
  );

  assert.match(
    html,
    /<a href="https:\/\/instagram\.com\/thewilliediaries">@thewilliediaries<\/a>/
  );
  assert.match(html, /<a href="https:\/\/example\.org">@someone<\/a>/);
});
