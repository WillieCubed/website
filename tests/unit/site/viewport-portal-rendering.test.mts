import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ViewportPortal from '@/components/site/ViewportPortal';

test('viewport feedback keeps its announcement and action in server HTML without a wrapper', () => {
  const content = createElement(
    'section',
    { role: 'status' },
    createElement('button', { type: 'button' }, 'Recover draft')
  );
  assert.equal(
    renderToStaticMarkup(createElement(ViewportPortal, null, content)),
    renderToStaticMarkup(content)
  );
});
