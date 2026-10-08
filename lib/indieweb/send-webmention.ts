import { type DefaultTreeAdapterMap, parse } from 'parse5';

import {
  type PublicFetchOptions,
  fetchPublicDocument,
} from '@/lib/indieweb/public-fetch';
import type { WebmentionSourceWriting } from '@/lib/indieweb/types';
import { site } from '@/lib/site';

const SITE_URL = site.origin;
const SITE_HOSTNAME = new URL(SITE_URL).hostname;
const FETCH_TIMEOUT = 10000;

export function targetsForUpdatedPost(
  current: string[],
  previous: string[]
): string[] {
  return [...new Set([...current, ...previous])];
}

interface SendResult {
  targetUrl: string;
  success: boolean;
  endpoint?: string;
  statusCode?: number;
  error?: string;
}

/**
 * Discover the webmention endpoint for a target URL.
 * Checks the HTTP Link header first, then the page's <link> and <a> elements.
 * A relative endpoint resolves against the URL reached after any redirects.
 */
export async function discoverWebmentionEndpoint(
  targetUrl: string,
  network: Pick<PublicFetchOptions, 'resolve' | 'fetch'> = {}
): Promise<string | null> {
  try {
    const head = await fetchPublicDocument(targetUrl, {
      ...network,
      method: 'HEAD',
      timeoutMs: FETCH_TIMEOUT,
      headers: { 'User-Agent': 'WillieCubed-Webmention-Sender/1.0' },
    });
    const headLink = head?.headers.get('link');
    if (headLink) {
      const endpoint = parseLinkHeader(headLink, 'webmention');
      if (endpoint !== null) return resolveUrl(endpoint, head!.url);
    }
    const document = await fetchPublicDocument(targetUrl, {
      ...network,
      timeoutMs: FETCH_TIMEOUT,
      headers: {
        Accept: 'text/html',
        'User-Agent': 'WillieCubed-Webmention-Sender/1.0',
      },
    });
    if (!document || document.status < 200 || document.status >= 300)
      return null;
    const link = document.headers.get('link');
    const endpoint = link ? parseLinkHeader(link, 'webmention') : null;
    return endpoint !== null
      ? resolveUrl(endpoint, document.url)
      : parseHtmlForWebmentionEndpoint(document.body, document.url);
  } catch (error) {
    console.error('Endpoint discovery failed:', error);
    return null;
  }
}

/**
 * One link-value from RFC 8288: a URI reference in angle brackets and its
 * parameters, up to the comma that ends it. Commas inside the brackets or a
 * quoted parameter value belong to the link, not the list. Tokens exclude `"`
 * so a quoted value reads only one way; otherwise a header that fails to match
 * backtracks exponentially.
 */
const LINK_VALUE =
  /[\s,]*<([^>]*)>((?:\s*;\s*[^\s=;,"]+(?:\s*=\s*(?:"(?:[^"\\]|\\.)*"|[^\s;,"]*))?)*)\s*(?:,|$)/gy;
const LINK_PARAM =
  /;\s*([^\s=;,"]+)(?:\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s;,"]*)))?/g;

/**
 * Find the first link in a Link header whose rel list includes `rel`.
 * Several Link headers arrive joined with commas, so they parse the same way.
 */
export function parseLinkHeader(header: string, rel: string): string | null {
  const wanted = rel.toLowerCase();
  // The sticky flag stops at the first malformed link rather than guessing.
  for (const link of header.matchAll(LINK_VALUE)) {
    for (const param of link[2].matchAll(LINK_PARAM)) {
      if (param[1].toLowerCase() !== 'rel') continue;
      // Only the first rel counts; relation types compare case-insensitively.
      const value = param[2]?.replace(/\\(.)/g, '$1') ?? param[3] ?? '';
      if (value.toLowerCase().split(/\s+/).includes(wanted)) return link[1];
      break;
    }
  }
  return null;
}

type Element = DefaultTreeAdapterMap['element'];
type ParentNode = DefaultTreeAdapterMap['parentNode'];

/** Every element under `node`, in document order. */
function* elements(node: ParentNode): Generator<Element> {
  for (const child of node.childNodes) {
    if (!('tagName' in child)) continue;
    yield child;
    yield* elements(child);
  }
}

function attribute(element: Element, name: string): string | undefined {
  return element.attrs.find((attr) => attr.name === name)?.value;
}

/**
 * Find the first <link> or <a> with rel=webmention in document order. The page
 * is parsed as HTML, so markup inside comments or escaped as text never counts,
 * and an element with no href is skipped. The href resolves against the page's
 * <base> or else `pageUrl`, so an empty href is the page itself.
 *
 * microformats-parser also reads rels, but it throws on a page whose body has
 * no elements and matches rel values by case and single spaces, so this walks
 * the parse5 tree it is built on.
 */
export function parseHtmlForWebmentionEndpoint(
  html: string,
  pageUrl: string
): string | null {
  const document = parse(html);
  let base = pageUrl;
  // Only the first <base> with an href sets the document's base URL.
  for (const element of elements(document)) {
    if (element.tagName !== 'base') continue;
    const href = attribute(element, 'href');
    if (href === undefined) continue;
    if (URL.canParse(href, pageUrl)) base = new URL(href, pageUrl).href;
    break;
  }

  for (const element of elements(document)) {
    if (element.tagName !== 'link' && element.tagName !== 'a') continue;
    const href = attribute(element, 'href');
    if (href === undefined) continue;
    // Relation types compare case-insensitively and split on any whitespace.
    const rels = attribute(element, 'rel')
      ?.toLowerCase()
      .split(/[\t\n\f\r ]+/);
    if (rels?.includes('webmention')) return resolveUrl(href, base);
  }
  return null;
}

/**
 * Resolve a potentially relative URL.
 */
function resolveUrl(url: string, base: string): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/**
 * Send a webmention to a single target.
 */
export async function sendWebmention(
  sourceUrl: string,
  targetUrl: string,
  network: Pick<PublicFetchOptions, 'resolve' | 'fetch'> = {}
): Promise<SendResult> {
  const endpoint = await discoverWebmentionEndpoint(targetUrl, network);

  if (!endpoint) {
    return {
      targetUrl,
      success: false,
      error: 'No webmention endpoint found',
    };
  }

  try {
    const response = await fetchPublicDocument(endpoint, {
      ...network,
      method: 'POST',
      timeoutMs: FETCH_TIMEOUT,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'WillieCubed-Webmention-Sender/1.0',
      },
      body: new URLSearchParams({ source: sourceUrl, target: targetUrl }),
    });
    if (!response)
      throw new Error(
        'The Webmention endpoint is not a public HTTP or HTTPS address.'
      );

    return {
      targetUrl,
      success: response.status >= 200 && response.status < 300,
      endpoint,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      targetUrl,
      success: false,
      endpoint,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Code a post shows rather than links to: fenced blocks (an unclosed fence
 * runs to the end), inline code spans that stop at a blank line, and the
 * <pre> and <code> elements they render to. GFM never autolinks inside code,
 * so a sample request never becomes a target.
 */
const FENCED_CODE =
  /^ {0,3}(`{3,}|~{3,})[^\n]*$[\s\S]*?(?:^ {0,3}\1[`~]*[ \t]*$|(?![\s\S]))/gm;
const CODE_ELEMENT = /<(pre|code)\b[^>]*>[\s\S]*?<\/\1>/gi;
const CODE_SPAN = /(?<!`)(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\1(?!`)/g;

/**
 * An absolute URL in an href, a Markdown link, or bare text. It stops at
 * whitespace, quotes, angle and square brackets, and backticks, which end an
 * attribute, a tag, link text, or a code span, so `[https://a.b](https://a.b)`
 * reads as two URLs rather than one.
 */
const URL_PATTERN = /https?:\/\/[^\s"'<>[\]`]+/gi;

/**
 * Drop what a sentence wraps around a URL, as GFM's autolinks do: trailing
 * punctuation and closing quotes, and a closing parenthesis that has no
 * opening partner inside the URL. `(see https://w.org/Foo_(bar)).` keeps the
 * parenthesis that belongs to the address and loses the other two marks.
 */
function trimUrl(url: string): string {
  let end = url.length;
  for (;;) {
    const last = url[end - 1];
    if ('.,!?;:*_~’”'.includes(last)) {
      end--;
      continue;
    }
    const rest = url.slice(0, end);
    if (last === ')' && rest.split(')').length > rest.split('(').length) {
      end--;
      continue;
    }
    return rest;
  }
}

/**
 * External http and https links in rendered HTML or a post's Markdown source,
 * in the order they first appear. Bare URLs count because the post renders
 * them as links.
 */
export function extractExternalLinks(content: string): string[] {
  const prose = content
    .replace(FENCED_CODE, ' ')
    .replace(CODE_ELEMENT, ' ')
    .replace(CODE_SPAN, ' ');
  const links: string[] = [];
  for (const [match] of prose.matchAll(URL_PATTERN)) {
    const url = trimUrl(match);
    try {
      const parsed = new URL(url);
      if (
        parsed.hostname !== SITE_HOSTNAME &&
        !parsed.hostname.endsWith(`.${SITE_HOSTNAME}`)
      ) {
        links.push(url);
      }
    } catch {
      // Skip invalid URLs
    }
  }

  // Remove duplicates
  return [...new Set(links)];
}

/**
 * Every page a writing sends webmentions to: the external links in its body,
 * then the posts it replies to, likes, reposts, bookmarks, or RSVPs to, then
 * the people it tags. Those interaction and person URLs live in frontmatter,
 * outside the body, so reading links from the body alone misses the one
 * target a reply exists to notify. Every sending path goes through this, so
 * none of them can disagree about what a post cites. The order is part of
 * the publisher's content hash, so changing it resends every post once.
 */
export function webmentionTargetsForWriting(
  writing: WebmentionSourceWriting,
  content: string
): string[] {
  const interactions = [
    writing.likeOf,
    writing.repostOf,
    writing.bookmarkOf,
    writing.inReplyTo,
    writing.rsvp?.eventUrl,
  ].filter((url): url is string => Boolean(url));
  return [
    ...new Set([
      ...extractExternalLinks(content),
      ...interactions,
      ...writing.people.map((person) => person.url),
    ]),
  ];
}

/**
 * Send webmentions from a writing to every target it cites.
 */
export async function sendWebmentionsForPost(
  writing: WebmentionSourceWriting,
  content: string,
  network: Pick<PublicFetchOptions, 'resolve' | 'fetch'> = {}
): Promise<SendResult[]> {
  const sourceUrl = `${SITE_URL}/writings/${writing.slug}`;
  const results: SendResult[] = [];

  for (const targetUrl of webmentionTargetsForWriting(writing, content)) {
    const result = await sendWebmention(sourceUrl, targetUrl, network);
    results.push(result);

    // Small delay to be polite
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}
