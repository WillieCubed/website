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
 * Checks both HTTP Link header and HTML <link> element.
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
    const linkHeader = response.headers.get('Link');
    if (linkHeader) {
      const endpoint = parseLinkHeader(linkHeader, 'webmention');
      if (endpoint) {
        return resolveUrl(endpoint, targetUrl);
      }
    }

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

    const html = await htmlResponse.text();
    const endpoint = parseHtmlForWebmentionEndpoint(html);

    if (endpoint) {
      return resolveUrl(endpoint, targetUrl);
    }

    return null;
  } catch (error) {
    console.error('Endpoint discovery failed:', error);
    return null;
  }
}

/**
 * Parse Link header for a specific rel type.
 */
function parseLinkHeader(header: string, rel: string): string | null {
  const links = header.split(',');
  for (const link of links) {
    const match = link.match(/<([^>]+)>.*rel=["']?([^"'\s;]+)/i);
    if (match && match[2].split(/\s+/).includes(rel)) {
      return match[1];
    }
  }
  return null;
}

/**
 * Parse HTML for webmention endpoint.
 */
function parseHtmlForWebmentionEndpoint(html: string): string | null {
  // Look for <link rel="webmention" href="...">
  const linkMatch = html.match(
    /<link[^>]*rel=["']?webmention["']?[^>]*href=["']([^"']+)["']/i
  );
  if (linkMatch) return linkMatch[1];

  // Also check reverse attribute order
  const linkMatch2 = html.match(
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']?webmention["']?/i
  );
  if (linkMatch2) return linkMatch2[1];

  // Check for <a rel="webmention" href="...">
  const anchorMatch = html.match(
    /<a[^>]*rel=["']?webmention["']?[^>]*href=["']([^"']+)["']/i
  );
  if (anchorMatch) return anchorMatch[1];

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
