import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/** Standalone track, album, and playlist links become Spotify embeds. */
export const remarkSpotify: Plugin<[], Root> = () => (tree: Root) => {
  visit(tree, 'paragraph', (node, index, parent) => {
    if (!parent || index === undefined || node.children.length !== 1) return;
    const child = node.children[0];
    const url =
      child.type === 'link'
        ? child.url
        : child.type === 'text'
          ? child.value.trim()
          : null;
    const match = url?.match(
      /^https:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)(\?.*)?$/
    );
    if (!match) return;
    const [, type, id] = match;
    (parent.children as unknown[])[index] = {
      type: 'mdxJsxFlowElement',
      name: 'SpotifyEmbed',
      attributes: [
        { type: 'mdxJsxAttribute', name: 'type', value: type },
        { type: 'mdxJsxAttribute', name: 'id', value: id },
      ],
      children: [],
    };
  });
};

export default remarkSpotify;
