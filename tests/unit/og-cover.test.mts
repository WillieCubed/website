import assert from 'node:assert/strict';
import test from 'node:test';

import { publicImageDataUri } from '@/lib/og/render';

test('a PNG cover is inlined for the social image', async () => {
  const uri = await publicImageDataUri(
    '/assets/projects/parlipro/feature-companion-view.png'
  );
  assert.match(uri ?? '', /^data:image\/png;base64,/);
});

// Satori cannot decode WebP; handing it one throws "u2 is not iterable" and
// the whole social image route fails. A skipped cover falls back to the
// brand gradient instead.
test('a WebP cover is skipped rather than handed to the renderer', async () => {
  const uri = await publicImageDataUri(
    '/assets/projects/parlipro/project-hero-graphic.webp'
  );
  assert.equal(uri, undefined);
});
