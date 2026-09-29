import assert from 'node:assert/strict';
import test from 'node:test';

import { MediaSchema } from '@/lib/initiatives/schema';

test('initiative media distinguishes described images from deliberate decoration', () => {
  assert.equal(
    MediaSchema.safeParse({ src: '/photo.jpg', alt: 'People at a station' })
      .success,
    true
  );
  assert.equal(
    MediaSchema.safeParse({
      src: '/cover.svg',
      alt: '',
      decorative: true,
    }).success,
    true
  );
  for (const media of [
    { src: '/photo.jpg', alt: '' },
    { src: '/photo.jpg', alt: '   ' },
    { src: '/cover.svg', alt: 'A motif', decorative: true },
    { src: '/cover.svg', alt: '   ', decorative: true },
  ]) {
    assert.equal(
      MediaSchema.safeParse(media).success,
      false,
      JSON.stringify(media)
    );
  }
});
