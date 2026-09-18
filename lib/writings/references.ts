import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * A reference is anything a passage points at: a footnote written as
 * `[^id]`, or a span marked up as `<Ref href title>text</Ref>`. Both get a
 * number in order of appearance, a popover on the mark, and an entry in the
 * list at the end of the page.
 */
export interface Reference {
  id: string;
  index: number;
  kind: 'note' | 'link';
  /** The note's text, or the link's title. */
  content: string;
  href?: string;
}

interface MdastLike {
  type: string;
  identifier?: string;
  name?: string;
  value?: string;
  attributes?: Array<{ type: string; name?: string; value?: unknown }>;
  children?: MdastLike[];
}

function text(nodes: MdastLike[] | undefined): string {
  let out = '';
  for (const node of nodes ?? []) {
    if (typeof node.value === 'string' && node.type !== 'mdxJsxTextElement')
      out += node.value;
    else if (node.children) out += text(node.children);
  }
  return out.trim();
}

function attr(node: MdastLike, name: string): string | undefined {
  const found = node.attributes?.find(
    (a) => a.type === 'mdxJsxAttribute' && a.name === name
  );
  return typeof found?.value === 'string' ? found.value : undefined;
}

/**
 * Numbers every reference in the order a reader meets it and returns the
 * list. The remark plugin and the page both call this, so the number on a
 * mark always matches the number in the list.
 */
export function collectReferences(tree: Root): Reference[] {
  const notes = new Map<string, string>();
  visit(tree, 'footnoteDefinition', (node) => {
    const definition = node as unknown as MdastLike;
    if (definition.identifier)
      notes.set(definition.identifier, text(definition.children));
  });

  const references: Reference[] = [];
  const seen = new Map<string, number>();
  const number = (key: string) => {
    const existing = seen.get(key);
    if (existing) return existing;
    const next = references.length + 1;
    seen.set(key, next);
    return next;
  };

  visit(tree, (visited) => {
    const node = visited as unknown as MdastLike;
    if (node.type === 'footnoteReference' && node.identifier) {
      const content = notes.get(node.identifier);
      if (content === undefined) return;
      const key = `note:${node.identifier}`;
      if (!seen.has(key)) {
        references.push({
          id: node.identifier,
          index: number(key),
          kind: 'note',
          content,
        });
      }
    }
    if (node.type === 'mdxJsxTextElement' && node.name === 'Ref') {
      const href = attr(node, 'href');
      const title = attr(node, 'title') ?? text(node.children);
      const id = attr(node, 'id') ?? href ?? title;
      if (!id) return;
      const key = `link:${id}`;
      if (!seen.has(key)) {
        references.push({
          id,
          index: number(key),
          kind: 'link',
          content: title,
          href,
        });
      }
    }
  });

  return references;
}

/** Parses a writing's MDX source and returns its references. */
export async function extractReferences(source: string): Promise<Reference[]> {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMdx)
    .parse(source) as Root;
  return collectReferences(tree);
}
