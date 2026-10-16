import assert from 'node:assert/strict';
import { test } from 'node:test';

import { proseText } from '@/components/studio/writingText';

test('catalog block prose retains authored children and string properties', () => {
  const text = proseText({
    type: 'catalogBlock',
    attrs: {
      children: 'The route',
      props: {
        title: 'Neighborhood map',
        description: 'Walk to the park',
        zoom: 12,
      },
    },
  });
  assert.equal(
    text.trim().replace(/\s+/g, ' '),
    'The route Neighborhood map Walk to the park'
  );
  assert.equal(proseText({ type: 'catalogBlock', attrs: {} }).trim(), '');
});
