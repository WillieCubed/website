import type { Element, Root } from 'hast';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { unified } from 'unified';

import { rehypeShiki } from '@/lib/writings/shiki-plugin';

const element = (
  tagName: string,
  children: Element['children'] = [],
  properties: Element['properties'] = {}
): Element => ({ type: 'element', tagName, properties, children });
const text = (value: string) => ({ type: 'text' as const, value });
const transform = (tree: Root) => unified().use(rehypeShiki).run(tree);

test('Shiki keeps the complete highlighted header, copy data, SVG, and HTML tree', async () => {
  const trees: Root[] = [
    {
      type: 'root',
      children: [
        element('section', [
          element('pre', [
            element('code', [text('4'), text('2')], {
              className: ['extra', 'language-json'],
            }),
          ]),
        ]),
      ],
    },
    {
      type: 'root',
      children: [element('pre', [element('code', [text('plain & <text>')])])],
    },
  ];
  const expected: unknown = JSON.parse(
    readFileSync(new URL('./fixtures/shiki-tree.json', import.meta.url), 'utf8')
  );
  const output = [];
  for (const tree of trees) output.push(await transform(tree));
  assert.deepEqual(output, expected);
});

test('Shiki leaves unsupported languages and non-code preformatted content unchanged', async () => {
  const tree: Root = {
    type: 'root',
    children: [
      element('pre', [
        element('code', [text('unchanged')], {
          className: ['language-not-a-language'],
        }),
      ]),
      element('pre', [text('plain')]),
      element('pre', [
        element('code', [text('one')]),
        element('code', [text('two')]),
      ]),
    ],
  };
  assert.deepEqual(await transform(structuredClone(tree)), tree);
});

test('Shiki keeps custom MDX node boundaries outside its HTML traversal', async () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'mdxJsxFlowElement',
        name: 'Example',
        children: [
          element('pre', [
            element('code', [text('42')], { className: ['language-json'] }),
          ]),
        ],
      },
    ],
  } as unknown as Root;
  assert.deepEqual(await transform(structuredClone(tree)), tree);
});
