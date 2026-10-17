'use client';

import { Extension, Node } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { ReactNodeViewRenderer } from '@tiptap/react';

import type { CatalogEntry } from '@/lib/studio/catalog';

import { CatalogView, SourceView } from './StudioNodeViews';

export type { CatalogEntry } from '@/lib/studio/catalog';
// Decorations are editor-only: the active block never changes the saved document.
export const ActiveWritingBlock = Extension.create({
  name: 'activeWritingBlock',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { $from, $to, from } = state.selection;
            // Follow the text block even inside a long list or quotation.
            const start = $from.depth > 0 ? $from.before($from.depth) : from;
            const node = state.doc.nodeAt(start);
            return node?.isBlock
              ? DecorationSet.create(state.doc, [
                  Decoration.node(start, start + node.nodeSize, {
                    class: 'studio-active-block',
                    'data-studio-focus':
                      $from.parent === $to.parent ? 'single' : 'range',
                  }),
                ])
              : DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
export const MdxSource = Node.create({
  name: 'mdxSource',
  group: 'block',
  atom: true,
  addAttributes: () => ({ source: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-mdx-source]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'div',
    { ...HTMLAttributes, 'data-mdx-source': '' },
  ],
  addNodeView: () => ReactNodeViewRenderer(SourceView),
});
export function makeCatalogBlock(
  entries: CatalogEntry[] | (() => CatalogEntry[])
) {
  return Node.create({
    name: 'catalogBlock',
    group: 'block',
    atom: true,
    addAttributes: () => ({
      id: { default: '' },
      version: { default: '1' },
      props: { default: {} },
      children: { default: null },
      portable: { default: '' },
      portableReview: { default: null },
      instance: { default: null },
    }),
    parseHTML: () => [{ tag: 'div[data-catalog-block]' }],
    renderHTML: ({ HTMLAttributes }) => [
      'div',
      { ...HTMLAttributes, 'data-catalog-block': '' },
    ],
    addNodeView: () =>
      ReactNodeViewRenderer(
        (props) => <CatalogView {...props} entries={entries} />,
        {
          // Labels, icons and text inside a control belong to that control, too.
          // Letting ProseMirror select this atom during their click can race an
          // attribute update or the trailing-paragraph transaction on editor focus.
          stopEvent: ({ event }) =>
            event.target instanceof Element &&
            !!event.target.closest(
              'button, input, textarea, select, label, a, summary, [role="button"]'
            ),
        }
      ),
  });
}
