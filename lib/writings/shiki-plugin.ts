import type { Element, Root } from 'hast';
import { type Highlighter, createHighlighter } from 'shiki';
import type { Plugin } from 'unified';

let highlighterPromise: Promise<Highlighter> | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: [
        'typescript',
        'javascript',
        'tsx',
        'jsx',
        'python',
        'bash',
        'shell',
        'css',
        'scss',
        'json',
        'yaml',
        'markdown',
        'mdx',
        'html',
        'sql',
        'go',
        'rust',
        'c',
        'cpp',
        'java',
        'swift',
        'kotlin',
        'diff',
      ],
    });
  }
  return highlighterPromise;
}

function isElement(node: unknown): node is Element {
  return (
    typeof node === 'object' &&
    node !== null &&
    'type' in node &&
    (node as { type: string }).type === 'element'
  );
}

export const rehypeShiki: Plugin<[], Root> = () => {
  return async (tree: Root) => {
    const highlighter = await getHighlighter();

    const visit = (
      node: Root | Element,
      callback: (node: Element, parent: Root | Element) => void,
      parent?: Root | Element
    ) => {
      if (isElement(node)) {
        callback(node, parent || tree);
      }
      if ('children' in node && Array.isArray(node.children)) {
        for (const child of node.children) {
          if (isElement(child)) {
            visit(child, callback, node);
          }
        }
      }
    };

    const nodesToProcess: { node: Element; parent: Root | Element }[] = [];

    visit(tree, (node, parent) => {
      if (
        node.tagName === 'pre' &&
        node.children.length === 1 &&
        isElement(node.children[0]) &&
        node.children[0].tagName === 'code'
      ) {
        nodesToProcess.push({ node, parent });
      }
    });

    for (const { node, parent } of nodesToProcess) {
      const codeNode = node.children[0] as Element;
      const className = codeNode.properties?.className;
      let lang = 'text';

      if (Array.isArray(className)) {
        const langClass = className.find(
          (c) => typeof c === 'string' && c.startsWith('language-')
        );
        if (langClass && typeof langClass === 'string') {
          lang = langClass.replace('language-', '');
        }
      }

      const codeText =
        codeNode.children
          .filter(
            (child): child is { type: 'text'; value: string } =>
              child.type === 'text'
          )
          .map((child) => child.value)
          .join('') || '';

      try {
        const html = highlighter.codeToHtml(codeText, {
          lang: lang,
          themes: {
            light: 'github-light',
            dark: 'github-dark',
          },
        });

        const wrapperDiv: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['code-block-wrapper', 'group', 'relative'],
            'data-language': lang,
          },
          children: [
            {
              type: 'element',
              tagName: 'div',
              properties: {
                className: [
                  'code-block-header',
                  'flex',
                  'items-center',
                  'justify-between',
                  'px-4',
                  'py-2',
                  'text-xs',
                  'text-gray-500',
                  'dark:text-gray-400',
                  'bg-gray-50',
                  'dark:bg-gray-800',
                  'border-b',
                  'border-gray-200',
                  'dark:border-gray-700',
                  'rounded-t-lg',
                ],
              },
              children: [
                {
                  type: 'element',
                  tagName: 'span',
                  properties: { className: ['code-language', 'font-mono'] },
                  children: [{ type: 'text', value: lang }],
                },
                {
                  type: 'element',
                  tagName: 'button',
                  properties: {
                    type: 'button',
                    className: [
                      'copy-button',
                      'p-1',
                      'rounded',
                      'hover:bg-gray-200',
                      'dark:hover:bg-gray-700',
                      'transition-colors',
                    ],
                    'data-code': codeText,
                    'aria-label': 'Copy code to clipboard',
                  },
                  children: [
                    {
                      type: 'element',
                      tagName: 'svg',
                      properties: {
                        xmlns: 'http://www.w3.org/2000/svg',
                        width: '16',
                        height: '16',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        strokeWidth: '2',
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        className: ['copy-icon'],
                      },
                      children: [
                        {
                          type: 'element',
                          tagName: 'rect',
                          properties: {
                            x: '9',
                            y: '9',
                            width: '13',
                            height: '13',
                            rx: '2',
                            ry: '2',
                          },
                          children: [],
                        },
                        {
                          type: 'element',
                          tagName: 'path',
                          properties: {
                            d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
                          },
                          children: [],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'raw',
              value: html.replace(
                '<pre',
                '<pre class="!mt-0 !rounded-t-none overflow-x-auto"'
              ),
            } as unknown as Element,
          ],
        };

        const parentChildren = parent.children as Element[];
        const index = parentChildren.indexOf(node);
        if (index !== -1) {
          parentChildren[index] = wrapperDiv;
        }
      } catch {
        // If highlighting fails, keep the original node
      }
    }
  };
};
