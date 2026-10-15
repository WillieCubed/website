import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

interface TextNode {
  type: string;
  value?: string;
  alt?: string;
  name?: string;
  children?: TextNode[];
  attributes?: { name?: string; value?: unknown }[];
}

const TEXT_SEPARATORS: Record<string, string> = {
  root: '\n\n',
  blockquote: '\n\n',
  list: '\n\n',
  mdxJsxFlowElement: '\n\n',
  table: '\n',
  tableRow: '\t',
  listItem: '\n',
};
function textSeparator(type: string): string {
  return TEXT_SEPARATORS[type] ?? '';
}

function leafText(node: TextNode): string | undefined {
  if (
    [
      'mdxjsEsm',
      'mdxFlowExpression',
      'mdxTextExpression',
      'definition',
    ].includes(node.type)
  )
    return '';
  if (['image', 'imageReference'].includes(node.type)) return node.alt ?? '';
  if (node.type === 'break') return '\n';
  if (['text', 'inlineCode', 'code'].includes(node.type))
    return node.value ?? '';
  return undefined;
}

function text(node: TextNode): string {
  const leaf = leafText(node);
  if (leaf !== undefined) return leaf;
  if (node.name && ['script', 'style', 'iframe'].includes(node.name)) return '';
  const children = node.children ?? [];
  const separator = textSeparator(node.type);
  const body = children.map(text).filter(Boolean).join(separator);
  const descriptions =
    node.attributes
      ?.filter(
        (attribute) =>
          ['alt', 'caption', 'title'].includes(attribute.name ?? '') &&
          typeof attribute.value === 'string'
      )
      .map((attribute) => attribute.value as string) ?? [];
  return [...descriptions, body].filter(Boolean).join('\n\n');
}

/** Parse content without evaluating MDX expressions or losing code and captions. */
export function stripMdxSyntax(content: string): string {
  const tree = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMdx)
    .parse(content);
  return text(tree as unknown as TextNode)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
