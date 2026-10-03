import assert from 'node:assert/strict';
import test from 'node:test';

import { stripMdxSyntax } from '@/lib/text/strip-mdx';

test('an image keeps its alt text and a link keeps its label', () => {
  assert.equal(
    stripMdxSyntax('![A stage at dusk](/img/stage.jpg) and [the tour](/tour).'),
    'A stage at dusk and the tour.'
  );
});

test('an image with no alt text leaves nothing behind', () => {
  assert.equal(
    stripMdxSyntax('Before ![](/img/stage.jpg) after'),
    'Before  after'
  );
});

test('a linked image reads as its alt text', () => {
  assert.equal(stripMdxSyntax('[![Poster](/img/poster.jpg)](/tour)'), 'Poster');
});
