import { type DefaultTreeAdapterMap, parse } from 'parse5';

import { site } from '@/lib/site';

const SITE_URL = site.origin;
const FETCH_TIMEOUT = 10000;

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
  targetUrl: string
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'WillieCubed-Webmention-Sender/1.0',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Check Link header first
    const headEndpoint = endpointFromLinkHeader(response, targetUrl);
    if (headEndpoint) return headEndpoint;

    // If no header, fetch the full page and check HTML
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT);

    let htmlResponse: Response;
    try {
      htmlResponse = await fetch(targetUrl, {
        signal: controller2.signal,
        headers: {
          Accept: 'text/html',
          'User-Agent': 'WillieCubed-Webmention-Sender/1.0',
        },
      });
    } finally {
      clearTimeout(timeoutId2);
    }

    if (!htmlResponse.ok) return null;

    // A server that leaves Link off its HEAD response still sends it here.
    const getEndpoint = endpointFromLinkHeader(htmlResponse, targetUrl);
    if (getEndpoint) return getEndpoint;

    const html = await htmlResponse.text();
    return parseHtmlForWebmentionEndpoint(html, htmlResponse.url || targetUrl);
  } catch (error) {
    console.error('Endpoint discovery failed:', error);
    return null;
  }
}

/**
 * The webmention endpoint in a response's Link header, resolved against the
 * URL the response came from after any redirects.
 */
function endpointFromLinkHeader(
  response: Response,
  targetUrl: string
): string | null {
  const linkHeader = response.headers.get('Link');
  if (!linkHeader) return null;
  const endpoint = parseLinkHeader(linkHeader, 'webmention');
  // An empty URI reference is the page itself, so only null means none.
  return endpoint === null
    ? null
    : resolveUrl(endpoint, response.url || targetUrl);
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
  targetUrl: string
): Promise<SendResult> {
  const endpoint = await discoverWebmentionEndpoint(targetUrl);

  if (!endpoint) {
    return {
      targetUrl,
      success: false,
      error: 'No webmention endpoint found',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'WillieCubed-Webmention-Sender/1.0',
        },
        body: new URLSearchParams({
          source: sourceUrl,
          target: targetUrl,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    return {
      targetUrl,
      success: response.ok || response.status === 202,
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
 * Extract all external links from HTML content.
 */
export function extractExternalLinks(html: string): string[] {
  const linkRegex = /href=["']([^"']+)["']/gi;
  const links: string[] = [];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    try {
      const parsed = new URL(url);
      // Only include external HTTPS links
      if (
        parsed.protocol === 'https:' &&
        parsed.hostname !== new URL(SITE_URL).hostname &&
        !parsed.hostname.endsWith('.willie.page')
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
 * Send webmentions to all external links in a post, plus any extra targets
 * that live outside the body, such as the post's person tags.
 */
export async function sendWebmentionsForPost(
  slug: string,
  htmlContent: string,
  extraTargets: string[] = []
): Promise<SendResult[]> {
  const sourceUrl = `${SITE_URL}/writings/${slug}`;
  const links = [
    ...new Set([...extractExternalLinks(htmlContent), ...extraTargets]),
  ];

  const results: SendResult[] = [];

  for (const targetUrl of links) {
    const result = await sendWebmention(sourceUrl, targetUrl);
    results.push(result);

    // Small delay to be polite
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}
