import assert from 'node:assert/strict';
import test from 'node:test';

import {
  breadcrumbLd,
  eventLd,
  graph,
  homeGraph,
  personLd,
  postingLd,
  postingType,
  profilePageLd,
  serializeJsonLd,
  webPageLd,
  websiteLd,
} from '@/lib/seo/jsonld';
import { site } from '@/lib/site';

/** A node with an `undefined` value would not survive JSON, so it fails here. */
function assertPlain(node: unknown) {
  assert.deepEqual(JSON.parse(JSON.stringify(node)), node);
}

test('websiteLd names the site and its short name', () => {
  const node = websiteLd();
  assert.equal(node['@type'], 'WebSite');
  assert.equal(node.name, site.name);
  assert.equal(node.alternateName, 'WillieCubed');
  assert.equal(node.url, site.origin);
  assertPlain(node);
});

test('personLd links the profiles, lists the ventures, and hides the email', () => {
  const node = personLd();
  assert.equal(node['@type'], 'Person');
  assert.deepEqual(
    node.sameAs,
    site.social.map((profile) => profile.href)
  );
  assert.ok(!('email' in node));
  const orgs = node.worksFor as Array<Record<string, unknown>>;
  assert.equal(orgs.length, site.ventures.length);
  assert.ok(orgs.every((org) => org['@type'] === 'Organization'));
  assert.ok(orgs.every((org) => String(org.url).startsWith('https://')));
  assertPlain(node);
});

test('profilePageLd points at the person', () => {
  assert.deepEqual(profilePageLd().mainEntity, { '@id': personLd()['@id'] });
});

test('homeGraph holds the website, the person, and the profile page', () => {
  const home = homeGraph();
  assert.equal(home['@context'], 'https://schema.org');
  const types = (home['@graph'] as Array<Record<string, unknown>>).map(
    (node) => node['@type']
  );
  assert.deepEqual(types, ['WebSite', 'Person', 'ProfilePage']);
});

test('postingLd carries dates, author, image, keywords, and series', () => {
  const post = postingLd({
    type: 'BlogPosting',
    path: '/writings/hello',
    title: 'Hello',
    description: 'A note.',
    published: new Date('2026-01-04T00:00:00Z'),
    updated: '2026-02-01T00:00:00Z',
    tags: ['personal', 'music'],
    image: '/writings/hello/opengraph-image',
    seriesName: 'Superbloom',
  });
  assert.equal(post['@type'], 'BlogPosting');
  assert.equal(post.headline, 'Hello');
  assert.equal(post.url, `${site.origin}/writings/hello`);
  assert.equal(post.datePublished, '2026-01-04T00:00:00.000Z');
  assert.equal(post.dateModified, '2026-02-01T00:00:00.000Z');
  assert.equal(post.image, `${site.origin}/writings/hello/opengraph-image`);
  assert.equal(post.keywords, 'personal, music');
  assert.deepEqual(post.author, { '@id': personLd()['@id'] });
  assert.deepEqual(post.isPartOf, {
    '@type': 'CreativeWorkSeries',
    name: 'Superbloom',
  });
  assertPlain(post);
});

test('postingLd omits what it does not have', () => {
  const post = postingLd({
    type: 'SocialMediaPosting',
    path: '/writings/hello',
    title: 'Hello',
    description: 'A note.',
    published: '2026-01-04T00:00:00Z',
    tags: [],
    image: '/writings/hello/opengraph-image',
  });
  assert.equal(post['@type'], 'SocialMediaPosting');
  assert.ok(!('dateModified' in post));
  assert.ok(!('keywords' in post));
  assert.ok(!('isPartOf' in post));
  assertPlain(post);
});

test('only an article that answers nothing is a BlogPosting', () => {
  const article = { postType: 'article' } as const;
  assert.equal(postingType(article), 'BlogPosting');
  assert.equal(postingType({ postType: 'note' }), 'SocialMediaPosting');
  assert.equal(postingType({ postType: 'photo' }), 'SocialMediaPosting');
  assert.equal(
    postingType({ ...article, inReplyTo: 'https://indieweb.org/IndieMark' }),
    'SocialMediaPosting'
  );
  for (const field of ['likeOf', 'repostOf', 'bookmarkOf'] as const) {
    assert.equal(
      postingType({ ...article, [field]: 'https://example.com/post' }),
      'SocialMediaPosting',
      field
    );
  }
  assert.equal(
    postingType({
      ...article,
      rsvp: { eventUrl: 'https://example.com/event', status: 'yes' },
    }),
    'SocialMediaPosting'
  );
});

test('breadcrumbLd starts at the homepage, numbers the trail, and makes the links absolute', () => {
  const trail = breadcrumbLd([
    { name: 'Initiatives', path: '/initiatives' },
    { name: 'Fall Tour', path: '/initiatives/fall-tour-2026' },
  ]);
  assert.deepEqual(trail.itemListElement, [
    {
      '@type': 'ListItem',
      position: 1,
      name: site.name,
      item: site.origin,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Initiatives',
      item: `${site.origin}/initiatives`,
    },
    {
      '@type': 'ListItem',
      position: 3,
      name: 'Fall Tour',
      item: `${site.origin}/initiatives/fall-tour-2026`,
    },
  ]);
});

test('eventLd is a scheduled in-person event Willie runs and appears in', () => {
  const event = eventLd({
    path: '/initiatives/fall-tour-2026/part-1',
    name: 'Fall Tour 2026 Part 1: A Boy Goes Back to Dallas',
    description: 'A tour.',
    startDate: '2026-09-24',
    endDate: '2026-09-27',
    places: [
      { name: 'Dallas', region: 'TX', lat: 32.8471, lng: -96.8518 },
      { name: 'Denton', lat: 33.2148, lng: -97.1331 },
    ],
    image: '/initiatives/fall-tour-2026/part-1/opengraph-image',
  });
  const url = `${site.origin}/initiatives/fall-tour-2026/part-1`;
  assert.equal(event['@type'], 'Event');
  assert.equal(event['@id'], `${url}#event`);
  assert.equal(event.url, url);
  assert.equal(event.startDate, '2026-09-24');
  assert.equal(event.endDate, '2026-09-27');
  assert.equal(event.eventStatus, 'https://schema.org/EventScheduled');
  assert.equal(
    event.eventAttendanceMode,
    'https://schema.org/OfflineEventAttendanceMode'
  );
  assert.deepEqual(event.organizer, { '@id': personLd()['@id'] });
  assert.deepEqual(event.performer, { '@id': personLd()['@id'] });
  assert.equal(event.image, `${url}/opengraph-image`);
  assert.deepEqual(event.location, [
    {
      '@type': 'Place',
      name: 'Dallas, TX',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Dallas',
        addressRegion: 'TX',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 32.8471,
        longitude: -96.8518,
      },
    },
    {
      '@type': 'Place',
      name: 'Denton',
      address: { '@type': 'PostalAddress', addressLocality: 'Denton' },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 33.2148,
        longitude: -97.1331,
      },
    },
  ]);
  assertPlain(event);
});

test('eventLd leaves out a location and image it does not have', () => {
  const event = eventLd({
    path: '/initiatives/fall-tour-2026/part-9',
    name: 'Part 9',
    description: 'Somewhere.',
    startDate: '2026-12-01',
    endDate: '2026-12-02',
    places: [],
  });
  assert.ok(!('location' in event));
  assert.ok(!('image' in event));
  assertPlain(event);
});

test('webPageLd lists an index and links the website and the person', () => {
  const page = webPageLd({
    type: 'CollectionPage',
    name: 'Initiatives',
    description: 'What Willie is running.',
    path: '/initiatives',
    image: '/initiatives/opengraph-image',
    items: [{ name: 'Fall Tour', path: '/initiatives/fall-tour-2026' }],
  });
  assert.equal(page['@type'], 'CollectionPage');
  assert.equal(page.url, `${site.origin}/initiatives`);
  assert.deepEqual(page.isPartOf, { '@id': websiteLd()['@id'] });
  assert.deepEqual(page.author, { '@id': personLd()['@id'] });
  assert.deepEqual(page.primaryImageOfPage, {
    '@type': 'ImageObject',
    url: `${site.origin}/initiatives/opengraph-image`,
  });
  assert.deepEqual(page.mainEntity, {
    '@type': 'ItemList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Fall Tour',
        url: `${site.origin}/initiatives/fall-tour-2026`,
      },
    ],
  });
  assertPlain(page);
});

test('webPageLd omits what it does not have', () => {
  const page = webPageLd({
    name: 'Fall Tour',
    description: 'A tour.',
    path: '/initiatives/fall-tour-2026',
    items: [],
  });
  assert.equal(page['@type'], 'WebPage');
  assert.ok(!('primaryImageOfPage' in page));
  assert.ok(!('mainEntity' in page));
  assertPlain(page);
});

test('serializeJsonLd cannot close its own script tag', () => {
  const out = serializeJsonLd({ name: '</script><b>x' });
  assert.ok(!out.includes('</script'));
  assert.equal(JSON.parse(out).name, '</script><b>x');
});

test('graph wraps nodes with the schema.org context', () => {
  assert.deepEqual(graph({ a: 1 }, { b: 2 }), {
    '@context': 'https://schema.org',
    '@graph': [{ a: 1 }, { b: 2 }],
  });
});

test('the Bluesky profile is a rel="me" profile and the syndication target', () => {
  const bluesky = site.syndication.find(
    (account) => account.service === 'Bluesky'
  );
  assert.ok(bluesky, 'tests/unit/test.env configures the account');
  assert.ok(
    site.social.some((profile) => profile.href === bluesky.profile),
    'site.social lists the Bluesky profile'
  );
  assert.ok((personLd().sameAs as string[]).includes(bluesky.profile));
});
