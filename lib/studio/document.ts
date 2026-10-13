import matter from 'gray-matter';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import sanitizeHtml from 'sanitize-html';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { validateMdxImageAlts } from '@/lib/accessibility/mdx-image-alt-check';
import { auditPortableContent, renderFeedHtml } from '@/lib/feeds/html';

import { catalogEntry } from './catalog';
import { StudioError } from './errors';
import type { DraftContent, EditorNode } from './types';

const MAX_SOURCE_BYTES = 1_000_000;
export function parseDraftContent(value: unknown): DraftContent {
  if (
    !value ||
    typeof value !== 'object' ||
    JSON.stringify(value).length > MAX_SOURCE_BYTES
  )
    throw new StudioError(400, 'The writing is invalid or too large.');
  const body = value as DraftContent;
  if (
    typeof body.title !== 'string' ||
    typeof body.description !== 'string' ||
    !['article', 'note'].includes(body.postType) ||
    !Array.isArray(body.tags) ||
    body.tags.some((x) => typeof x !== 'string') ||
    body.document?.type !== 'doc'
  )
    throw new StudioError(400, 'Invalid writing fields.');
  const allowed = new Set([
    'doc',
    'paragraph',
    'text',
    'heading',
    'blockquote',
    'bulletList',
    'orderedList',
    'listItem',
    'codeBlock',
    'hardBreak',
    'horizontalRule',
    'image',
    'table',
    'tableRow',
    'tableCell',
    'tableHeader',
    'mdxSource',
    'catalogBlock',
  ]);
  function check(node: EditorNode, depth: number) {
    if (
      depth > 50 ||
      !node ||
      typeof node.type !== 'string' ||
      !allowed.has(node.type)
    )
      throw new StudioError(400, 'Unsupported document node.');
    if (
      node.attrs !== undefined &&
      (!node.attrs ||
        typeof node.attrs !== 'object' ||
        Array.isArray(node.attrs))
    )
      throw new StudioError(400, 'Invalid document attributes.');
    if (
      node.marks !== undefined &&
      (!Array.isArray(node.marks) ||
        node.marks.some(
          (mark) =>
            !mark ||
            typeof mark !== 'object' ||
            !['bold', 'italic', 'strike', 'code', 'link', 'underline'].includes(
              mark.type
            ) ||
            (mark.attrs !== undefined &&
              (!mark.attrs ||
                typeof mark.attrs !== 'object' ||
                Array.isArray(mark.attrs)))
        ))
    )
      throw new StudioError(400, 'Invalid text formatting.');
    if (node.text !== undefined && typeof node.text !== 'string')
      throw new StudioError(400, 'Invalid text.');
    if (node.content !== undefined && !Array.isArray(node.content))
      throw new StudioError(400, 'Invalid document structure.');
    for (const child of node.content ?? []) check(child, depth + 1);
  }
  check(body.document, 0);
  return structuredClone(body);
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
  const children = () => (node.content ?? []).map(documentSource).join('');
  const a = node.attrs ?? {};
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(documentSource).join('\n\n');
    case 'text': {
      let text = literal(node.text ?? '');
      for (const mark of node.marks ?? []) {
        if (mark.type === 'bold') text = `**${text}**`;
        if (mark.type === 'italic') text = `*${text}*`;
        if (mark.type === 'strike') text = `~~${text}~~`;
        if (mark.type === 'code')
          text = '`' + (node.text ?? '').replaceAll('`', '\\`') + '`';
        if (mark.type === 'link' && safeUrl(mark.attrs?.href))
          text = `[${text}](${safeUrl(mark.attrs?.href).replaceAll(')', '%29')})`;
      }
      return text;
    }
    case 'paragraph':
      return children();
    case 'heading':
      return (
        '#'.repeat(Math.max(2, Math.min(6, Number(a.level) || 2))) +
        ' ' +
        children()
      );
    case 'hardBreak':
      return '  \n';
    case 'horizontalRule':
      return '---';
    case 'blockquote':
      return (node.content ?? [])
        .map(documentSource)
        .join('\n\n')
        .split('\n')
        .map((line) => '> ' + line)
        .join('\n');
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => '- ' + documentSource(item).replaceAll('\n', '\n  '))
        .join('\n');
    case 'orderedList':
      return (node.content ?? [])
        .map(
          (item, i) =>
            `${i + (Number(a.start) || 1)}. ` +
            documentSource(item).replaceAll('\n', '\n   ')
        )
        .join('\n');
    case 'listItem':
      return (node.content ?? []).map(documentSource).join('\n\n');
    case 'codeBlock': {
      const source = (node.content ?? []).map((x) => x.text ?? '').join('');
      const fence = '`'.repeat(
        Math.max(
          3,
          ...Array.from(source.matchAll(/`+/g), (m) => m[0].length + 1)
        )
      );
      return `${fence}${String(a.language ?? '').replace(/[^\w+-]/g, '')}\n${source}\n${fence}`;
    }
    case 'image':
      return `<Figure${attr('src', safeUrl(a.src))}${attr('alt', a.alt)}${a.title ? attr('caption', a.title) : ''} />`;
    case 'mdxSource':
      return String(a.source ?? '');
    case 'catalogBlock': {
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
    case 'table': {
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
    case 'tableCell':
    case 'tableHeader':
      return (node.content ?? []).map(documentSource).join(' ');
    default:
      throw new StudioError(422, `Unsupported writing node: ${node.type}`);
  }
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
  function check(node: EditorNode) {
    if (node.type === 'catalogBlock') {
      const attrs = node.attrs ?? {};
      const entry = catalogEntry(String(attrs.id), String(attrs.version));
      if (!entry && !attrs.portable)
        issues.push(
          'Use an approved catalog version with a portable alternative.'
        );
      if (entry)
        for (const [key, property] of Object.entries(entry.properties)) {
          const value = (attrs.props as Record<string, unknown> | undefined)?.[
            key
          ];
          if (
            property.required &&
            (typeof value !== property.type || String(value).trim() === '')
          )
            issues.push(`${entry.name}: ${key} is required.`);
        }
    }
    for (const child of node.content ?? []) check(child);
  }
  check(body.document);
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
        const target = (node as unknown as { url: string }).url;
        if (!safeUrl(target))
          issues.push('Use a safe public URL for media and links.');
      }
      if (
        node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement'
      ) {
        const element = node as unknown as {
          name: string;
          attributes: { type: string; name?: string; value?: unknown }[];
        };
        const safeElements = new Set([
          'Figure',
          'Callout',
          'Ref',
          'YouTube',
          'Spotify',
          'SoundCloud',
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
        if (!safeElements.has(element.name))
          issues.push(
            'Imported components need an approved catalog version before publication.'
          );
        for (const attribute of element.attributes ?? []) {
          if (
            attribute.type !== 'mdxJsxAttribute' ||
            (attribute.value !== null && typeof attribute.value !== 'string') ||
            /^on/i.test(attribute.name ?? '') ||
            attribute.name === 'dangerouslySetInnerHTML' ||
            attribute.name === 'style'
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
      }
    });
  } catch {
    issues.push('The MDX source is invalid.');
  }
  return [...new Set(issues)];
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
      `https://willie.page/writings/${slug}`
    );
  } catch {
    issues.push('A block needs a valid portable alternative.');
  }
  const clean = sanitizeHtml(portableHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'figure',
      'figcaption',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
      '*': ['id'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
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
