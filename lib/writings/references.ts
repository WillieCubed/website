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
export interface ReferenceTarget {
  id: string;
  kind: 'note' | 'link';
  /** The note's text, or the link's title. */
  content: string;
  href?: string;
}

export interface Reference extends ReferenceTarget {
  index: number;
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

function noteReference(
  node: MdastLike,
  notes: Map<string, string>
): ReferenceTarget | undefined {
  if (!node.identifier) return undefined;
  const content = notes.get(node.identifier);
  return content === undefined
    ? undefined
    : { id: node.identifier, kind: 'note', content };
}

function linkReference(node: MdastLike): ReferenceTarget | undefined {
  if (node.type !== 'mdxJsxTextElement' || node.name !== 'Ref')
    return undefined;
  const href = attr(node, 'href');
  const title = attr(node, 'title') ?? text(node.children);
  const id = attr(node, 'id') ?? href ?? title;
  return id ? { id, kind: 'link', content: title, href } : undefined;
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
  const seen = new Set<string>();
  visit(tree, (visited) => {
    const node = visited as unknown as MdastLike;
    const reference =
      node.type === 'footnoteReference'
        ? noteReference(node, notes)
        : linkReference(node);
    if (!reference) return;
    const key = `${reference.kind}:${reference.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    references.push({ ...reference, index: references.length + 1 });
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
