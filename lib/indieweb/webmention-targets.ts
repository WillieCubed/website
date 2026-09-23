import { absoluteUrl, site } from '@/lib/site';

/**
 * The canonical address a webmention target resolves to, or null when it
 * names no page on this site. `pages` is every page that exists, as the
 * sitemap lists them. A trailing slash, query, or fragment is dropped, so
 * `https://willie.page/writings/foo/?ref=x` is stored under the same address
 * the page reads its mentions from.
 */
export function canonicalWebmentionTarget(
  target: string,
  pages: Iterable<string>
): string | null {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return null;
  }
  if (url.origin !== new URL(site.origin).origin) return null;
  const canonical = absoluteUrl(url.pathname.replace(/\/+$/, '') || '/');
  return new Set(pages).has(canonical) ? canonical : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether `text` links to `targetUrl`, by its full address or, below the
 * homepage, by its path. The address has to end where the link does, so a
 * link to `/writings/foo-bar` does not count for `/writings/foo`. The
 * homepage's path is a bare slash that every link contains, so it counts
 * only by its full address.
 */
export function linksToTarget(text: string, targetUrl: string): boolean {
  const { origin, pathname } = new URL(targetUrl);
  const path = pathname.replace(/\/+$/, '');
  const address = path
    ? `(?:${escapeRegExp(origin)})?${escapeRegExp(path)}`
    : escapeRegExp(origin);
  return new RegExp(`${address}/?(?=[?#"'\\s<>]|$)`).test(text);
}
