import type { Element, Root as HastRoot } from 'hast';
import type { Root } from 'mdast';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { absoluteUrl } from '@/lib/site';
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

/**
 * The plain HTML a feed reader gets in place of each MDX component. Embeds
 * become links to what they embed, and components that only work on the
 * page, such as a route map or a gallery built from an expression, are
 * dropped. Anything not listed keeps its children and loses its wrapper.
 */
function replaceComponent(node: MdastLike, inline: boolean): MdastLike[] {
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
    case 'Gallery':
    case 'RouteMap':
      return [];
    default:
      return node.children ?? [];
  }
}

/** Replaces MDX components, imports, and expressions with plain markdown. */
function remarkPlainMdx() {
  const walk = (parent: MdastLike) => {
    if (!parent.children) return;
    parent.children = parent.children.flatMap((child): MdastLike[] => {
      switch (child.type) {
        case 'mdxjsEsm':
        case 'mdxFlowExpression':
        case 'mdxTextExpression':
          return [];
        case 'mdxJsxFlowElement':
        case 'mdxJsxTextElement': {
          const replaced = replaceComponent(
            child,
            child.type === 'mdxJsxTextElement'
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
export async function renderFeedHtml(source: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .use(remarkPlainMdx)
    .use(remarkMentions)
    .use(remarkRehype)
    .use(rehypeAbsoluteUrls)
    .use(rehypeStringify)
    .process(source);
  return String(file);
}
