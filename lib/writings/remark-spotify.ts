import type { Link, Paragraph, Root, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * Remark plugin that transforms standalone Spotify URLs into SpotifyEmbed components.
 *
 * Supports:
 * - https://open.spotify.com/track/ID
 * - https://open.spotify.com/album/ID
 * - https://open.spotify.com/playlist/ID
 *
 * The URL must be on its own line (in its own paragraph) to be transformed.
 */
export const remarkSpotify: Plugin<[], Root> = () => {
  const spotifyRegex =
    /^https:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)(\?.*)?$/;

  return (tree: Root) => {
    visit(
      tree,
      'paragraph',
      (node: Paragraph, index: number | undefined, parent) => {
        if (!parent || index === undefined) return;

        // Check if paragraph contains a single link or text that's a Spotify URL
        if (node.children.length === 1) {
          const child = node.children[0];
          let url: string | null = null;

          if (child.type === 'link') {
            url = (child as Link).url;
          } else if (child.type === 'text') {
            url = (child as Text).value.trim();
          }

          if (url) {
            const match = url.match(spotifyRegex);
            if (match) {
              const [, type, id] = match;

              // Replace paragraph with MDX JSX element
              const jsxNode = {
                type: 'mdxJsxFlowElement',
                name: 'SpotifyEmbed',
                attributes: [
                  {
                    type: 'mdxJsxAttribute',
                    name: 'type',
                    value: type,
                  },
                  {
                    type: 'mdxJsxAttribute',
                    name: 'id',
                    value: id,
                  },
                ],
                children: [],
              };

              (parent.children as unknown[])[index] = jsxNode;
            }
          }
        }
      }
    );
  };
};

export default remarkSpotify;
