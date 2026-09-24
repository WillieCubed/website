import type { Link, Parent, Root, Text } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * Handles that resolve somewhere other than the default Instagram profile.
 * Keys are lowercase without the leading @.
 */
export const MENTION_TARGETS: Record<string, string> = {
  thewilliediaries: 'https://instagram.com/thewilliediaries',
  williecubed: 'https://instagram.com/williecubed',
};

const DEFAULT_MENTION_ORIGIN = 'https://instagram.com/';

// Handles may contain interior dots, but cannot end with one. Otherwise a
// sentence-ending period becomes part of the profile URL.
const MENTION_PATTERN =
  /(^|[\s([])@([a-zA-Z0-9_](?:[a-zA-Z0-9_.]{0,28}[a-zA-Z0-9_])?)(?![\w@])/g;

export function resolveMention(handle: string): string {
  return (
    MENTION_TARGETS[handle.toLowerCase()] ??
    `${DEFAULT_MENTION_ORIGIN}${handle}`
  );
}

/**
 * Split one text node into text and link nodes around every @handle.
 * Returns null when the text has no mentions so the caller leaves it alone.
 */
export function splitMentions(value: string): Array<Text | Link> | null {
  const nodes: Array<Text | Link> = [];
  let lastIndex = 0;
  let matched = false;

  for (const match of value.matchAll(MENTION_PATTERN)) {
    matched = true;
    const [whole, lead, handle] = match;
    const start = (match.index ?? 0) + lead.length;
    if (start > lastIndex) {
      nodes.push({ type: 'text', value: value.slice(lastIndex, start) });
    }
    nodes.push({
      type: 'link',
      url: resolveMention(handle),
      title: null,
      children: [{ type: 'text', value: `@${handle}` }],
    });
    lastIndex = (match.index ?? 0) + whole.length;
  }

  if (!matched) return null;
  if (lastIndex < value.length) {
    nodes.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return nodes;
}

/**
 * Remark plugin that turns `@handle` in prose into a link to that account.
 * Text already inside a link or inline code is left untouched.
 */
export const remarkMentions: Plugin<[], Root> = () => (tree: Root) => {
  visit(tree, 'text', (node: Text, index, parent) => {
    if (!parent || index === undefined) return;
    if (parent.type === 'link' || parent.type === 'linkReference') return;

    const replacement = splitMentions(node.value);
    if (!replacement) return;

    (parent as Parent).children.splice(index, 1, ...replacement);
    return index + replacement.length;
  });
};

export default remarkMentions;
