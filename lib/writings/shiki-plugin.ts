import type { Element, Root } from 'hast';
import { type Highlighter, createHighlighter } from 'shiki';
import type { Plugin } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

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

function element(
  tagName: string,
  properties: Element['properties'],
  children: Element['children'] = []
): Element {
  return { type: 'element', tagName, properties, children };
}

export const rehypeShiki: Plugin<[], Root> = () => {
  return async (tree: Root) => {
    const highlighter = await getHighlighter();

    const nodesToProcess: { node: Element; parent: Root | Element }[] = [];
    visit(tree, (node, _index, parent) => {
      if (node.type !== 'element')
        return node.type === 'root' ? undefined : SKIP;
      if (
        node.tagName === 'pre' &&
        node.children.length === 1 &&
        node.children[0].type === 'element' &&
        node.children[0].tagName === 'code' &&
        parent &&
        (parent.type === 'root' || parent.type === 'element')
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
        if (typeof langClass === 'string') {
          lang = langClass.replace('language-', '');
        }
      }

      const codeText = codeNode.children
        .filter(
          (child): child is { type: 'text'; value: string } =>
            child.type === 'text'
        )
        .map((child) => child.value)
        .join('');

      try {
        const html = highlighter.codeToHtml(codeText, {
          lang: lang,
          themes: {
            light: 'github-light',
            dark: 'github-dark',
          },
        });

        const wrapperDiv = element(
          'div',
          {
            className: ['code-block-wrapper', 'group', 'relative'],
            'data-language': lang,
          },
          [
            element(
              'div',
              {
                className: [
                  'code-block-header',
                  'flex',
                  'items-center',
                  'justify-between',
                  'px-4',
                  'py-2',
                  'text-xs',
                  'text-on-surface-variant',
                  'bg-surface-container',
                  'border-b',
                  'border-outline-variant',
                  'rounded-t-lg',
                ],
              },
              [
                element('span', { className: ['code-language', 'font-mono'] }, [
                  { type: 'text', value: lang },
                ]),
                element(
                  'button',
                  {
                    type: 'button',
                    className: [
                      'copy-button',
                      'p-1',
                      'rounded',
                      'hover:bg-surface-container-highest',
                      'transition-colors',
                    ],
                    'data-code': codeText,
                    'aria-label': 'Copy code to clipboard',
                  },
                  [
                    element(
                      'svg',
                      {
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
                      [
                        element('rect', {
                          x: '9',
                          y: '9',
                          width: '13',
                          height: '13',
                          rx: '2',
                          ry: '2',
                        }),
                        element('path', {
                          d: 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
                        }),
                      ]
                    ),
                  ]
                ),
              ]
            ),
            {
              type: 'raw',
              value: html.replace(
                '<pre',
                '<pre class="!mt-0 !rounded-t-none overflow-x-auto"'
              ),
            } as unknown as Element,
          ]
        );

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
