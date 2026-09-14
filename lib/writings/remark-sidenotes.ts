import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * Footnote data extracted during processing
 */
export interface ExtractedFootnote {
  id: string;
  index: number;
  content: string;
}

// Store extracted footnotes for access by the page component
let extractedFootnotes: ExtractedFootnote[] = [];

/**
 * Get the footnotes extracted from the last processed document.
 * Call this after serialize() to get footnote data for rendering.
 */
export function getExtractedFootnotes(): ExtractedFootnote[] {
  return [...extractedFootnotes];
}

/**
 * Clear extracted footnotes (call before processing a new document)
 */
export function clearExtractedFootnotes(): void {
  extractedFootnotes = [];
}

interface FootnoteDefinitionNode {
  type: 'footnoteDefinition';
  identifier: string;
  children: Array<{
    type: string;
    value?: string;
    children?: FootnoteDefinitionNode['children'];
  }>;
}

interface FootnoteReferenceNode {
  type: 'footnoteReference';
  identifier: string;
}

interface ParentNode {
  children: Array<unknown>;
}

/**
 * Remark plugin that transforms footnotes for sidenote display.
 *
 * This plugin:
 * 1. Extracts footnote definitions and stores them for rendering
 * 2. Transforms footnote references into FootnoteRef components
 * 3. Removes the auto-generated footnotes section from the content
 *
 * Requires remark-gfm to be loaded first for footnote parsing.
 */
export const remarkSidenotes: Plugin<[], Root> = () => {
  return (tree: Root) => {
    // Clear previous footnotes
    extractedFootnotes = [];
    const footnoteDefinitions = new Map<
      string,
      { index: number; content: string }
    >();
    let footnoteIndex = 0;

    // First pass: collect all footnote definitions
    visit(tree, 'footnoteDefinition', (node: FootnoteDefinitionNode) => {
      if (node.identifier) {
        footnoteIndex++;
        const content = serializeContent(node.children);
        footnoteDefinitions.set(node.identifier, {
          index: footnoteIndex,
          content,
        });
        extractedFootnotes.push({
          id: node.identifier,
          index: footnoteIndex,
          content,
        });
      }
    });

    // Second pass: transform footnote references to JSX
    visit(
      tree,
      'footnoteReference',
      (
        node: FootnoteReferenceNode,
        index: number | undefined,
        parent: ParentNode | undefined
      ) => {
        if (!parent || index === undefined || !node.identifier) return;

        const footnote = footnoteDefinitions.get(node.identifier);
        if (!footnote) return;

        // Replace with MDX JSX element
        const jsxNode = {
          type: 'mdxJsxTextElement',
          name: 'FootnoteRef',
          attributes: [
            {
              type: 'mdxJsxAttribute',
              name: 'id',
              value: node.identifier,
            },
            {
              type: 'mdxJsxAttribute',
              name: 'index',
              value: String(footnote.index),
            },
            {
              type: 'mdxJsxAttribute',
              name: 'content',
              value: footnote.content,
            },
          ],
          children: [],
        };

        parent.children[index] = jsxNode;
      }
    );

    // Third pass: remove footnote definitions from the tree
    const nodesToRemove: Array<{ parent: ParentNode; index: number }> = [];

    visit(
      tree,
      'footnoteDefinition',
      (
        _node: FootnoteDefinitionNode,
        index: number | undefined,
        parent: ParentNode | undefined
      ) => {
        if (parent && index !== undefined) {
          nodesToRemove.push({ parent, index });
        }
      }
    );

    // Remove in reverse order to maintain correct indices
    for (let i = nodesToRemove.length - 1; i >= 0; i--) {
      const { parent, index } = nodesToRemove[i];
      parent.children.splice(index, 1);
    }
  };
};

/**
 * Serialize MDAST content nodes to plain text.
 */
function serializeContent(
  nodes: Array<{ type: string; value?: string; children?: Array<unknown> }>
): string {
  let text = '';

  for (const node of nodes) {
    if (node.value && typeof node.value === 'string') {
      text += node.value;
    } else if (node.children && Array.isArray(node.children)) {
      text += serializeContent(
        node.children as Array<{
          type: string;
          value?: string;
          children?: Array<unknown>;
        }>
      );
    }
  }

  return text.trim();
}

export default remarkSidenotes;
