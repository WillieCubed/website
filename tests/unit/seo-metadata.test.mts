import assert from 'node:assert/strict';
import test from 'node:test';

import { absoluteUrl, pageMetadata, site } from '@/lib/site';

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
