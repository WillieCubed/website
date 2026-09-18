import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

import { type Reference, collectReferences } from './references';

export type { Reference as ExtractedFootnote };

interface JsxAttribute {
  type: 'mdxJsxAttribute';
  name: string;
  value: string;
}

interface JsxNode {
  type: string;
  name?: string;
  identifier?: string;
  attributes?: JsxAttribute[];
  children?: unknown[];
}

interface ParentNode {
  children: unknown[];
}

const mark = (reference: Reference): JsxNode => ({
  type: 'mdxJsxTextElement',
  name: 'RefMark',
  attributes: [
    { type: 'mdxJsxAttribute', name: 'id', value: reference.id },
    { type: 'mdxJsxAttribute', name: 'index', value: String(reference.index) },
    { type: 'mdxJsxAttribute', name: 'kind', value: reference.kind },
    { type: 'mdxJsxAttribute', name: 'content', value: reference.content },
    ...(reference.href
      ? [
          {
            type: 'mdxJsxAttribute' as const,
            name: 'href',
            value: reference.href,
          },
        ]
      : []),
  ],
  children: [],
});

/**
 * Turns footnote references and `<Ref>` spans into numbered marks and drops
 * the footnote definitions, which the References list renders instead.
 * Numbers come from collectReferences so they match that list.
 */
export const remarkSidenotes: Plugin<[], Root> = () => {
  return (tree: Root) => {
    const references = collectReferences(tree);
    const byNote = new Map(
      references.filter((r) => r.kind === 'note').map((r) => [r.id, r])
    );
    const byLink = new Map(
      references.filter((r) => r.kind === 'link').map((r) => [r.id, r])
    );

    visit(
      tree,
      'footnoteReference',
      (
        node: JsxNode,
        index: number | undefined,
        parent: ParentNode | undefined
      ) => {
        if (!parent || index === undefined || !node.identifier) return;
        const reference = byNote.get(node.identifier);
        if (reference) parent.children[index] = mark(reference);
      }
    );

    visit(tree, 'mdxJsxTextElement', (visited) => {
      const node = visited as unknown as JsxNode;
      if (node.name !== 'Ref') return;
      const href = node.attributes?.find((a) => a.name === 'href')?.value;
      const title = node.attributes?.find((a) => a.name === 'title')?.value;
      const id =
        node.attributes?.find((a) => a.name === 'id')?.value ?? href ?? title;
      const reference = id ? byLink.get(id) : undefined;
      if (!reference) return;
      node.attributes = [
        ...(node.attributes ?? []).filter((a) => a.name !== 'index'),
        {
          type: 'mdxJsxAttribute',
          name: 'index',
          value: String(reference.index),
        },
        { type: 'mdxJsxAttribute', name: 'id', value: reference.id },
      ];
    });

    const definitions: Array<{ parent: ParentNode; index: number }> = [];
    visit(
      tree,
      'footnoteDefinition',
      (
        _node: JsxNode,
        index: number | undefined,
        parent: ParentNode | undefined
      ) => {
        if (parent && index !== undefined) definitions.push({ parent, index });
      }
    );
    for (let i = definitions.length - 1; i >= 0; i--) {
      const { parent, index } = definitions[i];
      parent.children.splice(index, 1);
    }
  };
};

export default remarkSidenotes;
