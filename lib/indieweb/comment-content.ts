import { type DefaultTreeAdapterMap, parseFragment, serialize } from 'parse5';
import sanitizeHtml from 'sanitize-html';

/**
 * How much of a reply a post shows, in characters of text. A longer reply
 * ends in "…", and its permalink has the rest.
 */
export const COMMENT_TEXT_LIMIT = 2000;
/**
 * Sanitized markup longer than this keeps its text only. Empty elements add
 * markup without adding text, so the text limit alone does not bound it.
 */
const COMMENT_HTML_LIMIT = 20_000;

type ParentNode = DefaultTreeAdapterMap['parentNode'];
type ChildNode = DefaultTreeAdapterMap['childNode'];

/** Cut `text` to `limit` characters, at a word break when one is near. */
function cut(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const head = text.slice(0, limit);
  const lastSpace = head.search(/\s\S*$/);
  const end = lastSpace > limit * 0.8 ? lastSpace : limit;
  return `${head.slice(0, end).trimEnd()}…`;
}

/**
 * A reply's plain text, the version feeds, search, and moderation read. It
 * stays text: whoever displays it escapes it for their own format.
 */
export function commentText(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed ? cut(trimmed, COMMENT_TEXT_LIMIT) : undefined;
}

/** The address a link in a reply points at, or null if it is not the web. */
function webHref(href: string | undefined, baseUrl: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, baseUrl);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}

/** Directional markup retains the author's chosen base direction in Micropub HTML. */
export function sanitizeCommentHtml(html: string, baseUrl: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'div',
      'span',
      'bdi',
      'bdo',
      'br',
      'a',
      'em',
      'strong',
      'blockquote',
      'code',
      'ul',
      'ol',
      'li',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'caption',
      'pre',
      'figure',
      'figcaption',
      'img',
      'audio',
      'video',
      'source',
      'track',
    ],
    allowedAttributes: {
      '*': ['dir'],
      a: ['href', 'rel', 'class'],
      img: ['src', 'alt', 'loading'],
      audio: ['src', 'controls', 'preload'],
      video: ['src', 'poster', 'controls', 'preload', 'playsinline'],
      source: ['src', 'type'],
      track: ['src', 'kind', 'srclang', 'label'],
    },
    allowedSchemes: ['http', 'https'],
    allowedClasses: { a: ['u-attachment'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    nonTextTags: [
      'script',
      'style',
      'textarea',
      'option',
      'noscript',
      'template',
      'iframe',
      'object',
      'svg',
      'math',
    ],
    transformTags: {
      b: 'strong',
      i: 'em',
      '*': (tagName, attribs): sanitizeHtml.Tag => {
        const attributes = { ...attribs };
        const directions =
          tagName === 'bdo' ? ['ltr', 'rtl'] : ['ltr', 'rtl', 'auto'];
        if (attributes.dir) attributes.dir = attributes.dir.toLowerCase();
        if (!directions.includes(attributes.dir)) delete attributes.dir;
        for (const name of ['src', 'poster']) {
          const url = webHref(attributes[name], baseUrl);
          if (url) attributes[name] = url;
          else delete attributes[name];
        }
        if (tagName === 'video' || tagName === 'audio')
          Object.assign(attributes, { controls: '', preload: 'none' });
        if (tagName === 'img') {
          attributes.loading = 'lazy';
          attributes.alt ??= '';
        }
        return { tagName, attribs: attributes };
      },
      a: (_tagName, attribs): sanitizeHtml.Tag => {
        const href = webHref(attribs.href, baseUrl);
        // The invalid-link tag is not allowed, so only its text remains.
        return href
          ? {
              tagName: 'a',
              attribs: {
                href,
                rel: 'nofollow ugc',
                ...(attribs.class?.split(/\s+/).includes('u-attachment')
                  ? { class: 'u-attachment' }
                  : {}),
                ...(attribs.dir ? { dir: attribs.dir } : {}),
              },
            }
          : attribs.dir
            ? { tagName: 'span', attribs: { dir: attribs.dir } }
            : { tagName: 'invalid-link', attribs: {} };
      },
    },
  });
}

function textLength(node: ParentNode): number {
  let length = 0;
  for (const child of node.childNodes) {
    if (child.nodeName === '#text' && 'value' in child) {
      length += child.value.length;
    } else if ('childNodes' in child) {
      length += textLength(child);
    }
  }
  return length;
}

/** Keep the first `budget.left` characters of text and every tag around them. */
function keepText(node: ParentNode, budget: { left: number }): void {
  const kept: ChildNode[] = [];
  for (const child of node.childNodes) {
    if (budget.left <= 0) break;
    if (child.nodeName === '#text' && 'value' in child) {
      if (child.value.length >= budget.left) {
        // The whole reply is over the limit, so text always follows this cut.
        child.value = `${cut(child.value, budget.left).replace(/…$/, '')}…`;
        budget.left = 0;
      } else {
        budget.left -= child.value.length;
      }
    } else if ('childNodes' in child) {
      keepText(child, budget);
    }
    kept.push(child);
  }
  node.childNodes = kept;
}

/**
 * A reply's markup as a post shows it: sanitized, then cut to the text limit
 * with "…" where it stops, keeping the tags open around the cut closed.
 * Undefined when nothing readable is left.
 */
export function commentHtml(html: string, baseUrl: string): string | undefined {
  const clean = sanitizeCommentHtml(html, baseUrl).trim();
  if (!clean) return undefined;
  const fragment = parseFragment(clean);
  if (textLength(fragment) === 0 && !/<(?:img|audio|video)\b/.test(clean))
    return undefined;
  if (textLength(fragment) > COMMENT_TEXT_LIMIT) {
    keepText(fragment, { left: COMMENT_TEXT_LIMIT });
  }
  const result = serialize(fragment);
  return result.length <= COMMENT_HTML_LIMIT ? result : undefined;
}
