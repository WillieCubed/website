import assert from 'node:assert/strict';
import test from 'node:test';

import {
  blogPostingLd,
  breadcrumbLd,
  eventLd,
  graph,
  homeGraph,
  personLd,
  profilePageLd,
  serializeJsonLd,
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
  assert.equal(node.url, `${site.origin}/`);
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

test('blogPostingLd carries dates, author, image, keywords, and series', () => {
  const post = blogPostingLd({
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

test('blogPostingLd omits what it does not have', () => {
  const post = blogPostingLd({
    path: '/writings/hello',
    title: 'Hello',
    description: 'A note.',
    published: '2026-01-04T00:00:00Z',
    tags: [],
    image: '/writings/hello/opengraph-image',
  });
  assert.ok(!('dateModified' in post));
  assert.ok(!('keywords' in post));
  assert.ok(!('isPartOf' in post));
  assertPlain(post);
});

const eventBase = {
  path: '/initiatives/fall-tour-2026/part-1',
  name: 'Part 1: Las Vegas',
  starts: new Date(2026, 8, 18),
  ends: new Date(2026, 8, 20),
  places: [],
};

test('eventLd is null without a place', () => {
  assert.equal(eventLd(eventBase), null);
});

test('eventLd describes a scheduled in-person event', () => {
  const event = eventLd({
    ...eventBase,
    places: [{ name: 'Las Vegas', region: 'NV', lat: 36.17, lng: -115.14 }],
    image: '/initiatives/fall-tour-2026/part-1/opengraph-image',
  });
  assert.ok(event);
  assert.equal(event['@type'], 'Event');
  assert.equal(event.startDate, '2026-09-18');
  assert.equal(event.endDate, '2026-09-20');
  assert.equal(event.eventStatus, 'https://schema.org/EventScheduled');
  assert.equal(
    event.eventAttendanceMode,
    'https://schema.org/OfflineEventAttendanceMode'
  );
  assert.deepEqual(event.location, [
    {
      '@type': 'Place',
      name: 'Las Vegas',
      address: 'Las Vegas, NV',
      geo: { '@type': 'GeoCoordinates', latitude: 36.17, longitude: -115.14 },
    },
  ]);
  assert.deepEqual(event.organizer, { '@id': personLd()['@id'] });
  assertPlain(event);
});

test('breadcrumbLd numbers the trail and makes the links absolute', () => {
  const trail = breadcrumbLd([
    { name: 'Initiatives', path: '/initiatives' },
    { name: 'Fall Tour', path: '/initiatives/fall-tour-2026' },
  ]);
  assert.deepEqual(trail.itemListElement, [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Initiatives',
      item: `${site.origin}/initiatives`,
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Fall Tour',
      item: `${site.origin}/initiatives/fall-tour-2026`,
    },
  ]);
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
