import { imageConfigDefault } from 'next/dist/shared/lib/image-config.js';
import assert from 'node:assert/strict';
import test from 'node:test';

import { imageDimensions } from '@/lib/content/generated-content';
import { localImageSources } from '@/lib/media/responsive';

const source = '/assets/home/transit-mapper.webp';
const immutableSrc = '/_content-images/' + 'a'.repeat(64) + '.webp';
imageDimensions[source] = { ...imageDimensions[source]!, immutableSrc };

test('known local content gets responsive sources without changing its geometry', () => {
  const image = localImageSources(
    '/assets/home/transit-mapper.webp',
    1200,
    630,
    '50vw'
  );
  assert.equal(image.src, source);
  assert.equal(
    new URL(image.srcSet!.split(' ')[0]!, 'http://fixture').searchParams.get(
      'url'
    ),
    immutableSrc
  );
  assert.ok(image.srcSet!.includes(encodeURIComponent(immutableSrc)));
  assert.ok(!image.srcSet!.includes(encodeURIComponent(source)));
  assert.match(image.srcSet!, /640w/);
  assert.equal(image.sizes, '50vw');
});

test('remote, protected, brand, animated and unknown-size images retain their native source', () => {
  for (const src of [
    'https://i.scdn.co/image/abc',
    '/api/studio/media/abc',
    '/brand/logo.png',
    '/assets/animation.gif',
    '/assets/unknown.jpg',
    '/assets/initiatives/superbloom/cover.svg',
    source + '?private=1',
  ])
    assert.deepEqual(localImageSources(src, 1200, 630, '50vw'), {});
  assert.deepEqual(
    localImageSources('/assets/photo.jpg', undefined, undefined, '50vw'),
    {}
  );
});

test('unoptimized preview requests retain the authored native URL and browser credentials', () => {
  const previous = imageConfigDefault.unoptimized;
  try {
    imageConfigDefault.unoptimized = true;
    const image = localImageSources(source, 1200, 630, '50vw');
    assert.equal(image.src, source);
    assert.equal(image.srcSet, undefined);
  } finally {
    imageConfigDefault.unoptimized = previous;
  }
});
