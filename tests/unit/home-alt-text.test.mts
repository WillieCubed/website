import assert from 'node:assert/strict';
import test from 'node:test';

import { type DetailMedia, products, ventures } from '@/lib/home/ventures';

/** Every screenshot a detail view shows, with the entry it belongs to. */
function detailImages(): { id: string; alt: string }[] {
  const details: { id: string; media: DetailMedia }[] = [
    ...ventures.map(({ id, detail }) => ({ id, media: detail.media })),
    ...Object.values(products).map(({ id, detail }) => ({
      id,
      media: detail.media,
    })),
  ];
  return details.flatMap(({ id, media }) => {
    if (media.kind === 'image') return [{ id, alt: media.alt }];
    if (media.kind === 'stack') {
      return media.images.map(({ alt }) => ({ id, alt }));
    }
    return [];
  });
}

test('every screenshot in a detail view is described', () => {
  const images = detailImages();
  assert.ok(images.length > 0);
  for (const { id, alt } of images) {
    assert.ok(alt.trim(), `${id} has a detail image with no alt text`);
  }
});

test('the studio detail describes each product screenshot', () => {
  const studio = ventures.find((venture) => venture.id === 'hypertext');
  assert.equal(studio?.detail.media.kind, 'stack');
  if (studio?.detail.media.kind !== 'stack') return;
  assert.deepEqual(
    studio.detail.media.images,
    Object.values(products).map((product) => ({
      ...product.image,
      alt: product.detail.media.alt,
    }))
  );
});

test('every tile screenshot is described', () => {
  for (const venture of ventures) {
    if (venture.body.kind !== 'shot') continue;
    assert.ok(venture.body.alt.trim(), `${venture.id} tile has no alt text`);
  }
});
