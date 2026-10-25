import type { Root } from 'mdast';
import assert from 'node:assert/strict';
import test from 'node:test';
import { unified } from 'unified';

import { remarkSpotify } from '@/lib/writings/remark-spotify';

const run = (tree: Root) => unified().use(remarkSpotify).runSync(tree);
test('Spotify standalone text and links retain their type, ID, and query handling', () => {
  for (const type of ['track', 'album', 'playlist']) {
    const url = `https://open.spotify.com/${type}/Ab12?si=123`;
    for (const child of [
      { type: 'text' as const, value: ` ${url} ` },
      {
        type: 'link' as const,
        url,
        children: [{ type: 'text' as const, value: 'Listen' }],
      },
    ]) {
      assert.deepEqual(
        run({
          type: 'root',
          children: [{ type: 'paragraph', children: [child] }],
        }).children,
        [
          {
            type: 'mdxJsxFlowElement',
            name: 'SpotifyEmbed',
            attributes: [
              { type: 'mdxJsxAttribute', name: 'type', value: type },
              { type: 'mdxJsxAttribute', name: 'id', value: 'Ab12' },
            ],
            children: [],
          },
        ]
      );
    }
  }
});
test('Spotify leaves unsupported URLs, mixed paragraphs, and inline code unchanged', () => {
  const tree: Root = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'https://open.spotify.com/artist/Ab12' },
        ],
      },
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'https://open.spotify.com/track/Ab12' },
          { type: 'text', value: ' extra' },
        ],
      },
      {
        type: 'paragraph',
        children: [
          { type: 'inlineCode', value: 'https://open.spotify.com/track/Ab12' },
        ],
      },
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: ' https://open.spotify.com/track/Ab12 ',
            children: [],
          },
        ],
      },
      { type: 'paragraph', children: [] },
    ],
  };
  assert.deepEqual(run(structuredClone(tree)), tree);
});
