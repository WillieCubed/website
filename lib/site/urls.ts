import { site } from './identity';

/**
 * True for paths on this site, including absolute URLs on the canonical
 * origin. Lives here rather than in the link component so server code can
 * use it too.
 */
export function isInternalHref(href: string): boolean {
  if (!href.startsWith('/') && !/^https?:/i.test(href)) return false;
  // Resolve the href the way a browser would rather than matching a prefix:
  // `https://willie.page.evil.com` shares the origin's spelling, and `//host`,
  // `/\host`, and `/<tab>/host` all leave the site despite the leading slash.
  try {
    return new URL(href, site.origin).origin === new URL(site.origin).origin;
  } catch {
    return false;
  }
}

/** Absolute URL for a path on the canonical origin. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, site.origin).toString();
}

/**
 * The canonical address of a page, spelled the way Next.js renders
 * `alternates.canonical` and og:url: the homepage is the bare origin with no
 * trailing slash. Structured data and the sitemap name pages with this so
 * every place a page's address appears agrees on one string.
 */
export function canonicalUrl(path = '/'): string {
  const url = new URL(path, site.origin);
  return url.pathname === '/' && !url.search && !url.hash
    ? url.origin
    : url.href;
}

/**
 * Tagged template for absolute site URLs. The result is always on the
 * canonical origin, whatever the interpolated values hold.
 *
 * @example absoluteRoute`/writings/${slug}`
 */
export function absoluteRoute(
  strings: TemplateStringsArray,
  ...values: Array<string | number>
): string {
  let path = '';
  strings.forEach((part, index) => {
    path += part;
    if (values[index] === undefined) return;
    const value = String(values[index]);
    // A value after a slash drops its own leading slashes, so
    // `/${'/evil.example'}` cannot become `//evil.example`.
    path += /[\\/]$/.test(path) ? value.replace(/^[\\/]+/, '') : value;
  });
  // The URL parser reads a leading `//` (or `\\`, or either split by a tab
  // or newline, which it strips) as a host, and a bare `https://…` as a
  // whole URL. Rooting the path at a single slash keeps both on this origin.
  return absoluteUrl(`/${path.replace(/^[\s\\/]+/, '')}`);
}

/**
 * A page's RSS, Atom, and JSON feeds, which sit beside the page: under it for
 * a section, at the root for the homepage.
 */
export function feedPaths(page: string): {
  rss: string;
  atom: string;
  json: string;
} {
  const base = page === '/' ? '' : page;
  return {
    rss: `${base}/feed.xml`,
    atom: `${base}/feed/atom`,
    json: `${base}/feed/json`,
  };
}

/** A page's feeds as the `alternates.types` its metadata advertises. */
export function feedAlternates(page: string): Record<string, string> {
  const feeds = feedPaths(page);
  return {
    'application/rss+xml': feeds.rss,
    'application/atom+xml': feeds.atom,
    'application/feed+json': feeds.json,
  };
}
