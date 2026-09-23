import { resolveAbsoluteUrlWithPathname } from 'next/dist/lib/metadata/resolvers/resolve-url.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { homeGraph, webPageLd } from '@/lib/seo/jsonld';
import { absoluteUrl, canonicalUrl, pageMetadata, site } from '@/lib/site';

type Loose = Record<string, unknown>;
type Meta = ReturnType<typeof pageMetadata>;

const openGraph = (meta: Meta) => meta.openGraph as Loose;
const twitter = (meta: Meta) => meta.twitter as Loose;

const input = { title: 'Writings', description: 'Notes.', path: '/writings' };

test('the site card is the default image, with dimensions and alt text', () => {
  const meta = pageMetadata(input);
  assert.deepEqual(openGraph(meta).images, [
    { url: site.ogImage, width: 1200, height: 630, alt: site.shortDescription },
  ]);
  assert.deepEqual(twitter(meta).images, [
    { url: site.ogImage, alt: site.shortDescription },
  ]);
  assert.equal(openGraph(meta).title, 'Writings');
  assert.equal(openGraph(meta).url, '/writings');
  assert.deepEqual(meta.alternates, { canonical: '/writings' });
});

/** The canonical link Next.js renders for a page's `alternates.canonical`. */
function renderedCanonical(meta: Meta, pathname: string): string {
  return resolveAbsoluteUrlWithPathname(
    String((meta.alternates as Loose).canonical),
    new URL(site.origin),
    pathname,
    { trailingSlash: false }
  );
}

test('canonical URLs are absolute on the origin, with a bare homepage', () => {
  assert.equal(canonicalUrl('/'), 'https://willie.page');
  assert.equal(canonicalUrl(), site.origin);
  assert.equal(canonicalUrl('/writings'), `${site.origin}/writings`);
  assert.equal(
    canonicalUrl('/writings/hello'),
    `${site.origin}/writings/hello`
  );
});

test('canonicalUrl spells each page the way Next.js renders its canonical', () => {
  for (const path of ['/', '/writings', '/initiatives/fall-tour-2026/part-1']) {
    const meta = pageMetadata({ ...input, path });
    assert.equal(renderedCanonical(meta, path), canonicalUrl(path));
  }
});

test('structured data names a page by its rendered canonical', () => {
  const nodes = homeGraph()['@graph'] as Loose[];
  const home = renderedCanonical({ alternates: { canonical: '/' } }, '/');
  for (const node of nodes) assert.equal(node.url, home);

  const page = webPageLd({
    name: 'Writings',
    description: 'Notes.',
    path: '/writings',
  });
  assert.equal(page.url, renderedCanonical(pageMetadata(input), '/writings'));
});

test('a custom image takes its alt from imageAlt, else the title', () => {
  const image = '/writings/opengraph-image';
  const plain = pageMetadata({ ...input, image });
  assert.deepEqual(openGraph(plain).images, [
    { url: image, width: 1200, height: 630, alt: 'Writings' },
  ]);
  const described = pageMetadata({ ...input, image, imageAlt: 'A pen.' });
  assert.deepEqual(twitter(described).images, [{ url: image, alt: 'A pen.' }]);
});

test('article fields are set only for articles', () => {
  const article = openGraph(
    pageMetadata({
      ...input,
      type: 'article',
      publishedTime: new Date('2026-01-04T00:00:00Z'),
      modifiedTime: '2026-02-01T00:00:00Z',
      tags: ['personal'],
      section: 'Superbloom',
    })
  );
  assert.equal(article.type, 'article');
  assert.equal(article.publishedTime, '2026-01-04T00:00:00.000Z');
  assert.equal(article.modifiedTime, '2026-02-01T00:00:00.000Z');
  assert.deepEqual(article.tags, ['personal']);
  assert.equal(article.section, 'Superbloom');
  assert.deepEqual(article.authors, [absoluteUrl('/')]);

  const website = openGraph(
    pageMetadata({ ...input, publishedTime: '2026-01-04' })
  );
  assert.ok(!('publishedTime' in website));
  assert.ok(!('authors' in website));
});

test('labels become Slack unfurl pairs, capped at two', () => {
  const meta = pageMetadata({
    ...input,
    labels: [
      ['Reading time', '4 min'],
      ['Published', 'Jan 4, 2026'],
      ['Extra', 'ignored'],
    ],
  });
  assert.deepEqual(meta.other, {
    'twitter:label1': 'Reading time',
    'twitter:data1': '4 min',
    'twitter:label2': 'Published',
    'twitter:data2': 'Jan 4, 2026',
  });
  assert.equal(pageMetadata(input).other, undefined);
});

test('noIndex keeps links followable', () => {
  assert.deepEqual(pageMetadata({ ...input, noIndex: true }).robots, {
    index: false,
    follow: true,
  });
  assert.equal(pageMetadata(input).robots, undefined);
});
