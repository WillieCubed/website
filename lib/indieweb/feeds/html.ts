import type { Element, Root as HastRoot } from 'hast';
import type { Root } from 'mdast';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { absoluteUrl } from '@/lib/site/urls';
import { remarkMentions } from '@/lib/writings/remark-mentions';

interface MdastLike {
  type: string;
  name?: string | null;
  attributes?: Array<{ type: string; name?: string; value?: unknown }>;
  children?: MdastLike[];
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

function attr(node: MdastLike, name: string): string | undefined {
  const found = node.attributes?.find(
    (a) => a.type === 'mdxJsxAttribute' && a.name === name
  );
  return typeof found?.value === 'string' ? found.value : undefined;
}

const text = (value: string): MdastLike => ({ type: 'text', value });

const link = (url: string, label: string): MdastLike => ({
  type: 'link',
  url,
  title: null,
  children: [text(label)],
});

/** A block that the HTML step renders as `tagName`. */
const block = (tagName: string, children: MdastLike[]): MdastLike => ({
  type: 'paragraph',
  data: { hName: tagName },
  children,
});

/** An image with its caption, the way ImageWithCaption and Scene show one. */
function figure(node: MdastLike): MdastLike[] {
  const src = attr(node, 'src');
  if (!src) return node.children ?? [];
  const caption = attr(node, 'caption');
  return [
    block('figure', [
      { type: 'image', url: src, alt: attr(node, 'alt') ?? '', title: null },
      ...(caption ? [block('figcaption', [text(caption)])] : []),
    ]),
    ...(node.children ?? []),
  ];
}

/** Decode only an explicit, plain-Markdown portable alternative; never evaluate MDX. */
export function decodePortableMarkdown(
  encoded: string | undefined
): string | null {
  if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
  const bytes = Buffer.from(encoded, 'base64url');
  if (bytes.toString('base64url') !== encoded) return null;
  const source = bytes.toString('utf8');
  if (!source.trim() || source.includes('\uFFFD')) return null;
  try {
    const tree = unified()
      .use(remarkParse)
      .use(remarkMdx)
      .use(remarkGfm)
      .parse(source);
    let executable = false;
    let readable = false;
    visit(tree, (child) => {
      if (child.type.startsWith('mdx')) executable = true;
      if (
        (child.type === 'text' || child.type === 'code') &&
        child.value.trim()
      )
        readable = true;
      if (child.type === 'image' && child.alt?.trim()) readable = true;
    });
    if (executable || !readable) return null;
    return source;
  } catch {
    return null;
  }
}

function portableMarkdown(node: MdastLike): MdastLike[] | null {
  const source = decodePortableMarkdown(attr(node, 'portable'));
  if (!source) return null;
  return unified().use(remarkParse).use(remarkGfm).parse(source)
    .children as unknown as MdastLike[];
}

/** Publication gate for catalog blocks: a feed must retain useful content. */
export function auditPortableContent(source: string): string[] {
  const issues: string[] = [];
  try {
    const tree = unified().use(remarkParse).use(remarkMdx).parse(source);
    visit(tree, (child) => {
      const node = child as unknown as MdastLike;
      if (
        (node.name === 'StudioBlock' || node.name === 'PortableBlock') &&
        !portableMarkdown(node)
      ) {
        issues.push(
          `${node.name} requires nonblank portable Markdown without executable MDX.`
        );
      }
    });
  } catch {
    issues.push('Content must parse as valid MDX before publication.');
  }
  return issues;
}

/** Embeds become links; interactive components retain a portable alternative. */
function replaceComponent(
  node: MdastLike,
  inline: boolean,
  originalUrl?: string
): MdastLike[] {
  const embed = (url: string | undefined, label: string) => {
    if (!url) return [];
    const anchor = link(url, label);
    return [inline ? anchor : { type: 'paragraph', children: [anchor] }];
  };

  switch (node.name) {
    case 'Ref': {
      const href = attr(node, 'href');
      return href
        ? [{ type: 'link', url: href, title: null, children: node.children }]
        : (node.children ?? []);
    }
    case 'Callout': {
      const title = attr(node, 'title');
      const heading = title
        ? [
            {
              type: 'paragraph',
              children: [{ type: 'strong', children: [text(title)] }],
            },
          ]
        : [];
      return [block('aside', [...heading, ...(node.children ?? [])])];
    }
    case 'Figure':
    case 'ImageWithCaption':
    case 'Scene':
      return figure(node);
    case 'Spotify':
    case 'SpotifyEmbed':
      return embed(attr(node, 'url'), 'Listen on Spotify');
    case 'SoundCloud':
    case 'SoundCloudEmbed':
      return embed(attr(node, 'url'), 'Listen on SoundCloud');
    case 'YouTube':
    case 'YouTubeEmbed': {
      const videoId = attr(node, 'videoId');
      return embed(
        videoId && `https://www.youtube.com/watch?v=${videoId}`,
        attr(node, 'title') ?? 'Watch on YouTube'
      );
    }
    case 'StudioBlock':
    case 'PortableBlock': {
      const portable = portableMarkdown(node);
      if (!portable)
        throw new Error(`${node.name} is missing valid portable Markdown`);
      return [
        ...portable,
        ...(node.name === 'StudioBlock' && originalUrl
          ? [
              block('p', [
                link(
                  originalUrl,
                  'Open interactive version on the original page'
                ),
              ]),
            ]
          : []),
      ];
    }
    case 'Gallery':
    case 'RouteMap': {
      const label =
        attr(node, 'title') ||
        (node.name === 'Gallery' ? 'Photo gallery' : 'Route map');
      return [
        block('p', [
          ...(originalUrl
            ? [link(originalUrl, `${label}: view on the original page`)]
            : [
                text(
                  `${label}. View this interactive content on the original page.`
                ),
              ]),
        ]),
        ...(node.children ?? []),
      ];
    }
    default:
      return node.children ?? [];
  }
}

/** Replaces MDX components, imports, and expressions with plain markdown. */
function remarkPlainMdx(options: { originalUrl?: string } = {}) {
  const walk = (parent: MdastLike) => {
    if (!parent.children) return;
    parent.children = parent.children.flatMap((child): MdastLike[] => {
      switch (child.type) {
        case 'mdxjsEsm':
          return [];
        case 'mdxFlowExpression':
          return [
            block('p', [
              text('Interactive content is available on the original page.'),
            ]),
          ];
        case 'mdxTextExpression':
          return [
            text('[Interactive content is available on the original page.]'),
          ];
        case 'mdxJsxFlowElement':
        case 'mdxJsxTextElement': {
          const replaced = replaceComponent(
            child,
            child.type === 'mdxJsxTextElement',
            options.originalUrl
          );
          replaced.forEach(walk);
          return replaced;
        }
        default:
          walk(child);
          return [child];
      }
    });
  };
  return (tree: Root) => walk(tree as unknown as MdastLike);
}

/** Resolves site-relative links and images against the canonical origin. */
function rehypeAbsoluteUrls() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      for (const property of ['href', 'src'] as const) {
        const value = node.properties[property];
        if (typeof value === 'string' && /^\/(?!\/)/.test(value)) {
          node.properties[property] = absoluteUrl(value);
        }
      }
    });
  };
}

/**
 * Renders an MDX body to the HTML a feed carries as an item's full content.
 * Feed readers run no scripts and load no site styles, so components become
 * plain HTML and every site-relative URL becomes absolute.
 */
export async function renderFeedHtml(
  source: string,
  originalUrl?: string
): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkPlainMdx, { originalUrl })
    .use(remarkMentions)
    .use(remarkRehype)
    .use(rehypeAbsoluteUrls)
    .use(rehypeStringify)
    .process(source);
  return String(file);
}
