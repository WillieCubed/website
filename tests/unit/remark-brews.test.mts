import type { Root } from 'mdast';
import assert from 'node:assert/strict';
import test from 'node:test';
import { unified } from 'unified';

import { remarkBrews, splitBrews } from '@/lib/writings/remark-brews';

test('splitBrews links each standalone word and keeps its capitalisation', () => {
  assert.deepEqual(splitBrews('Coffee first, then tea.'), [
    { word: 'Coffee', href: '/coffee' },
    ' first, then ',
    { word: 'tea', href: '/tea' },
    '.',
  ]);
});

test('splitBrews leaves longer words, compounds, and plain copy alone', () => {
  assert.equal(splitBrews('The teapot is steaming.'), null);
  assert.equal(splitBrews('A tea-time coffeehouse.'), null);
  assert.equal(splitBrews("The coffee's cold."), null);
  assert.equal(splitBrews('No drinks here.'), null);
});

function transform(tree: Root) {
  const run = remarkBrews.call(unified(), undefined);
  // The transformer never reads the file, so an empty stand-in is enough.
  run!(tree, undefined as never, () => {});
}

test('remarkBrews turns prose into BrewLink elements', () => {
  const tree: Root = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Over coffee, ' },
          { type: 'emphasis', children: [{ type: 'text', value: 'tea' }] },
        ],
      },
    ],
  };
  transform(tree);

  const paragraph = tree.children[0];
  assert.equal(paragraph.type, 'paragraph');
  if (paragraph.type !== 'paragraph') return;
  const types = paragraph.children.map((node) => node.type as string);
  assert.deepEqual(types, ['text', 'mdxJsxTextElement', 'text', 'emphasis']);
  assert.deepEqual(paragraph.children[1], {
    type: 'mdxJsxTextElement',
    name: 'BrewLink',
    attributes: [{ type: 'mdxJsxAttribute', name: 'href', value: '/coffee' }],
    children: [{ type: 'text', value: 'coffee' }],
  });
  const emphasis = paragraph.children[3];
  assert.equal(
    emphasis.type === 'emphasis' && (emphasis.children[0].type as string),
    'mdxJsxTextElement'
  );
});

test('remarkBrews skips headings, links, and code', () => {
  const tree: Root = {
    type: 'root',
    children: [
      { type: 'heading', depth: 2, children: [{ type: 'text', value: 'Tea' }] },
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            children: [
              { type: 'strong', children: [{ type: 'text', value: 'coffee' }] },
            ],
          },
          { type: 'inlineCode', value: 'tea' },
        ],
      },
      { type: 'code', value: 'brew coffee' },
    ],
  };
  const before = structuredClone(tree);
  transform(tree);
  assert.deepEqual(tree, before);
});
