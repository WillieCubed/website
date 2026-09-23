import type { Parent, Root, Text } from 'mdast';
import type { Plugin } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

/**
 * The words that lead to the teapot, and where. Both targets are route
 * handlers speaking HTCPCP (docs/protocols.md), not pages.
 */
export const BREW_TARGETS: Record<string, string> = {
  coffee: '/coffee',
  tea: '/tea',
};

// The word on its own: not part of a longer word ("teapot", "steam"), a
// hyphenated compound ("tea-time"), or a contraction ("coffee's").
const BREW_PATTERN = /(?<![\w'’-])(coffee|tea)(?![\w'’-])/gi;

export type BrewSegment = string | { word: string; href: string };

/**
 * Split copy into plain strings and the brew words inside it, keeping each
 * word's own capitalisation. Returns null when the copy names neither.
 */
export function splitBrews(value: string): BrewSegment[] | null {
  const segments: BrewSegment[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(BREW_PATTERN)) {
    const [word] = match;
    const start = match.index ?? 0;
    if (start > lastIndex) segments.push(value.slice(lastIndex, start));
    segments.push({ word, href: BREW_TARGETS[word.toLowerCase()] });
    lastIndex = start + word.length;
  }

  if (segments.length === 0) return null;
  if (lastIndex < value.length) segments.push(value.slice(lastIndex));
  return segments;
}

interface JsxNode {
  type: string;
  name?: string | null;
}

/** The MDX component a brew word becomes; see components/link/BrewLink.tsx. */
export const BREW_COMPONENT = 'BrewLink';

const brewElement = (word: string, href: string) => ({
  type: 'mdxJsxTextElement' as const,
  name: BREW_COMPONENT,
  attributes: [{ type: 'mdxJsxAttribute' as const, name: 'href', value: href }],
  children: [{ type: 'text' as const, value: word }],
});

// Nodes whose text stays as written: a heading is a title, not prose, and a
// link inside a link is invalid HTML. Code never reaches the visitor as text.
const isSkipped = (node: JsxNode) =>
  node.type === 'heading' ||
  node.type === 'link' ||
  node.type === 'linkReference' ||
  ((node.type === 'mdxJsxTextElement' || node.type === 'mdxJsxFlowElement') &&
    (node.name === 'a' || node.name === BREW_COMPONENT));

/**
 * Remark plugin that turns a standalone "coffee" or "tea" in prose into a
 * small link to /coffee or /tea. Headings, links, and code are left alone.
 */
export const remarkBrews: Plugin<[], Root> = () => (tree: Root) => {
  visit(tree, (node, index, parent) => {
    if (isSkipped(node as JsxNode)) return SKIP;
    if (node.type !== 'text' || !parent || index === undefined) return;

    const segments = splitBrews((node as Text).value);
    if (!segments) return;

    const replacement = segments.map((segment) =>
      typeof segment === 'string'
        ? { type: 'text' as const, value: segment }
        : brewElement(segment.word, segment.href)
    );
    (parent as Parent).children.splice(
      index,
      1,
      ...(replacement as Parent['children'])
    );
    return [SKIP, index + replacement.length];
  });
};

export default remarkBrews;
