import assert from 'node:assert/strict';
import test from 'node:test';

import { localImageSources } from '@/lib/media/responsive';

test('known local content gets responsive sources without changing its geometry', () => {
  const image = localImageSources(
    '/assets/home/transit-mapper.webp',
    1200,
    630,
    '50vw'
  );
  assert.match(image.src!, /^\/_next\/image\?url=/);
  assert.match(image.srcSet!, /640w/);
  assert.equal(image.sizes, '50vw');
});

test('remote, protected, brand, animated and unknown-size images retain their native source', () => {
  for (const src of [
    'https://i.scdn.co/image/abc',
    '/api/studio/media/abc',
    '/brand/logo.png',
    '/assets/animation.gif',
  ])
    assert.deepEqual(localImageSources(src, 1200, 630, '50vw'), {});
  assert.deepEqual(
    localImageSources('/assets/photo.jpg', undefined, undefined, '50vw'),
    {}
  );
});
