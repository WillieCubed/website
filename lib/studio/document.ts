import matter from 'gray-matter';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import sanitizeHtml from 'sanitize-html';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { z } from 'zod';

import { validateMdxImageAlts } from '@/lib/accessibility/mdx-image-alt-check';
import {
  auditPortableContent,
  renderFeedHtml,
} from '@/lib/indieweb/feeds/html';
import { absoluteUrl } from '@/lib/site/urls';

import { BUILTIN_CATALOG, type CatalogEntry, catalogEntry } from './catalog';
import { StudioError } from './errors';
import { studioHtmlPolicy } from './html-policy';
import type { DraftContent, EditorMark, EditorNode } from './types';

const MAX_SOURCE_BYTES = 1_000_000;
export function parseDraftContent(value: unknown): DraftContent {
  if (
    !value ||
    typeof value !== 'object' ||
    JSON.stringify(value).length > MAX_SOURCE_BYTES
  )
    throw new StudioError(400, 'The writing is invalid or too large.');
  const body = value as DraftContent;
  if (!draftFields.safeParse(body).success)
    throw new StudioError(400, 'Invalid writing fields.');

  validateDocumentNode(body.document, 0);
  return structuredClone(body);
}

const record = z.custom<Record<string, unknown>>(
  (value) => !!value && typeof value === 'object' && !Array.isArray(value)
);
const draftFields = z.object({
  title: z.string(),
  description: z.string(),
  postType: z.enum(['article', 'note']),
  tags: z.array(z.string()),
  document: z.object({ type: z.literal('doc') }),
});
const nodeFields = z.object({
  attrs: record.optional(),
  marks: z
    .array(
      z.object({
        type: z.enum(['bold', 'italic', 'strike', 'code', 'link', 'underline']),
        attrs: record.optional(),
      })
    )
    .optional(),
  text: z.string().optional(),
  content: z.array(z.unknown()).optional(),
});
const fieldErrors = {
  attrs: 'Invalid document attributes.',
  marks: 'Invalid text formatting.',
  text: 'Invalid text.',
  content: 'Invalid document structure.',
};
// Tables render their rows directly, so rows have no standalone renderer.
function validateDocumentNode(node: EditorNode, depth: number): void {
  if (
    depth > 50 ||
    node == null ||
    typeof node.type !== 'string' ||
    !(node.type === 'tableRow' || Object.hasOwn(sourceRenderers, node.type))
  )
    throw new StudioError(400, 'Unsupported document node.');
  const fields = nodeFields.safeParse(node);
  if (!fields.success)
    throw new StudioError(
      400,
      fieldErrors[fields.error.issues[0].path[0] as keyof typeof fieldErrors]
    );
  for (const child of node.content ?? [])
    validateDocumentNode(child, depth + 1);
}

export function importMdx(source: string, baseFileSha?: string): DraftContent {
  const { data, content } = matter(source);
  return {
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    postType: data.postType === 'note' ? 'note' : 'article',
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    document: {
      type: 'doc',
      content: [{ type: 'mdxSource', attrs: { source: content } }],
    },
    frontmatter: data,
    originalSource: source,
    ...(baseFileSha ? { baseFileSha } : {}),
  };
}

function literal(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('{', '&#123;')
    .replaceAll('}', '&#125;')
    .replace(/[\\`*_[\]]/g, '\\$&');
}

function safeUrl(value: unknown): string {
  const url = String(value ?? '');
  return /^(?:https?:\/\/|\/(?!\/)|#|mailto:)/i.test(url) ? url : '';
}

const attr = (name: string, value: unknown) =>
  ` ${name}="${String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('{', '&#123;')}"`;

export function documentSource(node: EditorNode): string {
  const render = Object.hasOwn(sourceRenderers, node.type)
    ? sourceRenderers[node.type]
    : undefined;
  if (!render)
    throw new StudioError(422, `Unsupported writing node: ${node.type}`);
  return render(node);
}
const joinedSource =
  (separator: string) =>
  (node: EditorNode): string =>
    (node.content ?? []).map(documentSource).join(separator);
const sourceRenderers: Record<string, (node: EditorNode) => string> = {
  doc: joinedSource('\n\n'),
  paragraph: joinedSource(''),
  listItem: joinedSource('\n\n'),
  tableCell: joinedSource(' '),
  tableHeader: joinedSource(' '),
  hardBreak: () => '  \n',
  horizontalRule: () => '---',
  mdxSource: (node) => String(node.attrs?.source ?? ''),
  text: textSource,
  codeBlock: codeSource,
  catalogBlock: catalogSource,
  table: tableSource,
  blockquote: quoteSource,
  bulletList: bulletListSource,
  orderedList: orderedListSource,
  image: imageSource,
  heading: headingSource,
};
function textSource(node: EditorNode): string {
  let text = literal(node.text ?? '');
  for (const mark of node.marks ?? [])
    text = applyTextMark(text, node.text ?? '', mark);
  return text;
}

function applyTextMark(
  text: string,
  original: string,
  mark: EditorMark
): string {
  switch (mark.type) {
    case 'bold':
      return `**${text}**`;
    case 'italic':
      return `*${text}*`;
    case 'strike':
      return `~~${text}~~`;
    case 'code':
      return '`' + original.replaceAll('`', '\\`') + '`';
    case 'link': {
      const href = safeUrl(mark.attrs?.href);
      return href ? `[${text}](${href.replaceAll(')', '%29')})` : text;
    }
    default:
      return text;
  }
}

function codeSource(node: EditorNode): string {
  const a = node.attrs ?? {};
  const source = (node.content ?? []).map((x) => x.text ?? '').join('');
  const fence = '`'.repeat(
    Math.max(3, ...Array.from(source.matchAll(/`+/g), (m) => m[0].length + 1))
  );
  return `${fence}${String(a.language ?? '').replace(/[^\w+-]/g, '')}\n${source}\n${fence}`;
}

function catalogSource(node: EditorNode): string {
  const a = node.attrs ?? {};
  const props = (a.props ?? {}) as Record<string, unknown>;
  const entry = catalogEntry(String(a.id), String(a.version));
  if (!entry)
    return `<StudioBlock${attr('id', a.id)}${attr('version', a.version)}${attr('src', a.src)}${attr('portable', Buffer.from(String(a.portable ?? '').trim()).toString('base64url'))} />`;
  const attributes = Object.keys(entry.properties)
    .filter((key) => props[key] !== undefined && key !== 'transcript')
    .map((key) => attr(key, props[key]))
    .join('');
  const inner = String(a.children ?? '');
  const element = inner
    ? `<${entry.component}${attributes}>${inner}</${entry.component}>`
    : `<${entry.component}${attributes} />`;
  return (
    element +
    (props.transcript ? '\n\n' + literal(String(props.transcript)) : '')
  );
}

function tableSource(node: EditorNode): string {
  const rows = node.content ?? [];
  return rows
    .map(
      (row, i) =>
        '| ' +
        (row.content ?? [])
          .map((cell) =>
            documentSource(cell)
              .replaceAll('|', '\\|')
              .replaceAll('\n', '<br />')
          )
          .join(' | ') +
        ' |' +
        (i === 0
          ? '\n| ' + (row.content ?? []).map(() => '---').join(' | ') + ' |'
          : '')
    )
    .join('\n');
}

function quoteSource(node: EditorNode): string {
  return (node.content ?? [])
    .map(documentSource)
    .join('\n\n')
    .split('\n')
    .map((line) => '> ' + line)
    .join('\n');
}

function bulletListSource(node: EditorNode): string {
  return (node.content ?? [])
    .map((item) => '- ' + documentSource(item).replaceAll('\n', '\n  '))
    .join('\n');
}

function orderedListSource(node: EditorNode): string {
  const a = node.attrs ?? {};
  const parsedStart = Number(a.start);
  const start =
    parsedStart === 0 || Number.isNaN(parsedStart) ? 1 : parsedStart;
  return (node.content ?? [])
    .map(
      (item, i) =>
        `${i + start}. ` + documentSource(item).replaceAll('\n', '\n   ')
    )
    .join('\n');
}

function imageSource(node: EditorNode): string {
  const a = node.attrs ?? {};
  return `<Figure${attr('src', safeUrl(a.src))}${attr('alt', a.alt)}${a.title ? attr('caption', a.title) : ''} />`;
}

function headingSource(node: EditorNode): string {
  const a = node.attrs ?? {};
  const parsedLevel = Number(a.level);
  const level =
    parsedLevel === 0 || Number.isNaN(parsedLevel) ? 2 : parsedLevel;
  const children = () => (node.content ?? []).map(documentSource).join('');
  return '#'.repeat(Math.max(2, Math.min(6, level))) + ' ' + children();
}

export function exportMdx(
  body: DraftContent,
  slug: string,
  revisionId?: string
): string {
  const original = body.frontmatter ?? {};
  const published = original.published ?? new Date().toISOString();
  const data = {
    ...original,
    ...(body.postType === 'article' || body.title ? { title: body.title } : {}),
    description: body.description,
    postType: ['reply', 'like', 'repost', 'bookmark', 'rsvp', 'photo'].includes(
      String(original.postType)
    )
      ? original.postType
      : body.postType,
    tags: body.tags.filter(Boolean),
    published,
    lastUpdated: new Date().toISOString(),
    draft: false,
    ...(revisionId ? { studioRevision: revisionId } : {}),
  };
  return matter.stringify(documentSource(body.document), data);
}

export async function validatePublication(
  body: DraftContent
): Promise<string[]> {
  const issues: string[] = [];
  if (body.postType === 'article' && !body.title.trim())
    issues.push('Give the article a title.');
  const source = documentSource(body.document);
  if (!source.trim()) issues.push('Add some writing before publishing.');
  for (const issue of await validateMdxImageAlts('writing.mdx', source))
    issues.push(issue.message);
  issues.push(...auditPortableContent(source));
  if (/\/api\/studio\/assets\//.test(source))
    issues.push('Private assets must be promoted before publication.');
  collectCatalogIssues(body.document, issues);

  try {
    const tree = unified().use(remarkParse).use(remarkMdx).parse(source);
    visit(tree, (node) => {
      if (
        ['mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression'].includes(
          node.type
        )
      )
        issues.push(
          'Imported MDX code needs an approved catalog component and portable alternative before publication.'
        );
      if (node.type === 'link' || node.type === 'image') {
        const target = (node as unknown as MdxUrlNode).url;
        if (!safeUrl(target))
          issues.push('Use a safe public URL for media and links.');
      }
      mdxElementIssues(node, issues);
    });
  } catch {
    issues.push('The MDX source is invalid.');
  }
  return [...new Set(issues)];
}

function collectCatalogIssues(node: EditorNode, issues: string[]): void {
  catalogIssues(node, issues);
  for (const child of node.content ?? []) collectCatalogIssues(child, issues);
}
function catalogIssues(node: EditorNode, issues: string[]): void {
  if (node.type !== 'catalogBlock') return;
  const attrs = node.attrs ?? {};
  const entry = catalogEntry(String(attrs.id), String(attrs.version));
  if (!entry && !attrs.portable)
    issues.push('Use an approved catalog version with a portable alternative.');
  if (!entry) return;
  catalogPropertyIssues(
    entry,
    attrs.props as Record<string, unknown> | undefined,
    issues
  );
}

function catalogPropertyIssues(
  entry: CatalogEntry,
  props: Record<string, unknown> | undefined,
  issues: string[]
): void {
  for (const [key, property] of Object.entries(entry.properties)) {
    const value = props?.[key];
    if (
      property.required &&
      (typeof value !== property.type || String(value).trim() === '')
    )
      issues.push(`${entry.name}: ${key} is required.`);
  }
}

interface MdxUrlNode {
  url: string;
}
interface MdxElement {
  name: string;
  attributes: MdxAttribute[];
}
interface MdxNode {
  type: string;
}

const safeElements = new Set([
  ...BUILTIN_CATALOG.map((entry) => entry.component),
  'StudioBlock',
  'br',
  'strong',
  'em',
  'sup',
  'sub',
  'kbd',
  'mark',
  'details',
  'summary',
  'p',
  'span',
  'div',
  'a',
  'img',
  'figure',
  'figcaption',
  'blockquote',
]);
function mdxElementIssues(node: MdxNode, issues: string[]): void {
  if (!['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(node.type)) return;
  const element = node as unknown as MdxElement;

  if (!safeElements.has(element.name))
    issues.push(
      'Imported components need an approved catalog version before publication.'
    );
  for (const attribute of element.attributes ?? [])
    mdxAttributeIssues(attribute, issues);
}
interface MdxAttribute {
  type: string;
  name?: string;
  value?: unknown;
}

function mdxAttributeIssues(attribute: MdxAttribute, issues: string[]): void {
  if (
    attribute.type !== 'mdxJsxAttribute' ||
    (attribute.value !== null && typeof attribute.value !== 'string') ||
    executableAttributeName(attribute.name)
  )
    issues.push(
      'Executable MDX attributes need an approved catalog component before publication.'
    );
  if (
    ['href', 'src'].includes(attribute.name ?? '') &&
    typeof attribute.value === 'string' &&
    !safeUrl(attribute.value)
  )
    issues.push('Use a safe public URL for media and links.');
}

function executableAttributeName(name = ''): boolean {
  return (
    /^on/i.test(name) || ['dangerouslySetInnerHTML', 'style'].includes(name)
  );
}

export async function portablePreview(body: DraftContent, slug: string) {
  const source = documentSource(body.document);
  const issues = (await validatePublication(body)).filter(
    (issue) => issue !== 'Private assets must be promoted before publication.'
  );
  let portableHtml = '';
  try {
    portableHtml = await renderFeedHtml(
      source,
      absoluteUrl(`/writings/${slug}`)
    );
  } catch {
    issues.push('A block needs a valid portable alternative.');
  }
  const clean = sanitizeHtml(portableHtml, {
    ...studioHtmlPolicy,
    allowedAttributes: {
      ...studioHtmlPolicy.allowedAttributes,
      img: ['src', 'alt', 'title'],
    },
  });
  const style =
    '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:18px/1.65 system-ui;color:#292822;background:#faf8f2;margin:24px;overflow-wrap:anywhere}img{max-width:100%;height:auto}pre{overflow:auto}a{color:#48664b}blockquote{border-left:3px solid #9ba58b;padding-left:1em}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:.5em}</style>';
  return {
    html: style + clean,
    portableHtml: style + clean,
    portableText: sanitizeHtml(
      clean.replace(/<\/(?:p|h\d|li|blockquote|figure)>/g, '\n\n'),
      { allowedTags: [], allowedAttributes: {} }
    ),
    issues,
  };
}
