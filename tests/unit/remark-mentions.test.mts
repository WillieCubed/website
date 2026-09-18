import type { Root } from 'mdast';
import assert from 'node:assert/strict';
import test from 'node:test';
import { unified } from 'unified';

import {
  remarkMentions,
  resolveMention,
  splitMentions,
} from '@/lib/writings/remark-mentions';

test('resolveMention maps known handles and defaults to Instagram', () => {
  assert.equal(
    resolveMention('thewilliediaries'),
    'https://instagram.com/thewilliediaries'
  );
  assert.equal(
    resolveMention('WillieCubed'),
    'https://instagram.com/williecubed'
  );
  assert.equal(
    resolveMention('someone_else'),
    'https://instagram.com/someone_else'
  );
});

test('splitMentions links handles and leaves surrounding text alone', () => {
  const nodes = splitMentions('Follow @thewilliediaries for the tour.');
  assert.ok(nodes);
  assert.deepEqual(
    nodes.map((node) => node.type),
    ['text', 'link', 'text']
  );
  assert.equal(nodes[0].type === 'text' && nodes[0].value, 'Follow ');
  assert.equal(
    nodes[1].type === 'link' && nodes[1].url,
    'https://instagram.com/thewilliediaries'
  );
  assert.equal(nodes[2].type === 'text' && nodes[2].value, ' for the tour.');
});

test('splitMentions ignores email addresses and text without handles', () => {
  assert.equal(splitMentions('mail hello@example.com today'), null);
  assert.equal(splitMentions('no handles here'), null);
});

test('remarkMentions rewrites text nodes in place and skips existing links', () => {
  const tree: Root = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'See @williecubed and ' },
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', value: '@not_a_mention' }],
          },
        ],
      },
    ],
  };

  const transform = remarkMentions.call(unified(), undefined);
  // The transformer never reads the file, so an empty stand-in is enough.
  transform!(tree, undefined as never, () => {});

  const paragraph = tree.children[0];
  assert.equal(paragraph.type, 'paragraph');
  if (paragraph.type !== 'paragraph') return;
  assert.deepEqual(
    paragraph.children.map((node) => node.type),
    ['text', 'link', 'text', 'link']
  );
  const mention = paragraph.children[1];
  assert.equal(
    mention.type === 'link' && mention.url,
    'https://instagram.com/williecubed'
  );
  const existing = paragraph.children[3];
  assert.equal(existing.type === 'link' && existing.url, 'https://example.com');
});
