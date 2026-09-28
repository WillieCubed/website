import { absoluteUrl, site } from '@/lib/site';

const CANONICAL = new URL(site.origin);
/** Hosts that redirect to the canonical origin path for path. */
const PATH_HOSTS = new Set<string>([CANONICAL.host, ...site.legacyHosts]);
/** Hosts that redirect every path to one page on the canonical origin. */
const ALIAS_HOSTS = new Map<string, string>(Object.entries(site.aliasHosts));

/**
 * The path of the page on this site that `address` leads to, without a
 * trailing slash, so the homepage is ''. Null when it leads anywhere else.
 * The canonical host, the legacy hosts, and the alias hosts all count,
 * because next.config.ts redirects each of them onto the canonical origin.
 * The scheme must be the canonical one, and a protocol-relative address
 * takes it.
 */
export function sitePath(address: string): string | null {
  let url: URL;
  try {
    url = new URL(address, CANONICAL);
  } catch {
    return null;
  }
  if (url.protocol !== CANONICAL.protocol) return null;
  const alias = ALIAS_HOSTS.get(url.host);
  if (alias !== undefined) return alias.replace(/\/+$/, '');
  if (!PATH_HOSTS.has(url.host)) return null;
  return url.pathname.replace(/\/+$/, '');
}

/**
 * The canonical address a webmention target resolves to, or null when it
 * names no page on this site. `pages` is every page that exists, as the
 * sitemap lists them. A trailing slash, query, or fragment is dropped, and a
 * legacy or alias host is replaced by the page it redirects to, so
 * `https://www.willie.page/writings/foo/?ref=x` is stored under the same
 * address the page reads its mentions from.
 */
export function canonicalWebmentionTarget(
  target: string,
  pages: Iterable<string>
): string | null {
  // A relative target would resolve against this site; a sender must name it.
  if (!URL.canParse(target)) return null;
  const path = sitePath(target);
  if (path === null) return null;
  const canonical = absoluteUrl(path || '/');
  return new Set(pages).has(canonical) ? canonical : null;
}

/**
 * An absolute or protocol-relative address in HTML or text, up to the
 * whitespace, quote, or angle bracket that ends an attribute or a tag. An
 * address that starts inside a word or another URL's path is skipped, so the
 * copy of this site's address inside an archive link does not count.
 */
const ADDRESS = /(?:(?<![\w+./-])https?:|(?<![\w+./:-]))\/\/[^\s"'<>]+/gi;

/**
 * Whether `text` links to `targetUrl`: some address in it leads to the same
 * page on this site, whatever trailing slash, query, or fragment it carries.
 * A relative link never counts. The source lives on another origin, so a
 * relative link there leads to a page on that origin, not this one. The
 * address has to end where the link does, so a link to `/writings/foo-bar`
 * does not count for `/writings/foo`.
 */
export function linksToTarget(text: string, targetUrl: string): boolean {
  const wanted = sitePath(targetUrl);
  if (wanted === null) return false;
  for (const [address] of text.matchAll(ADDRESS)) {
    if (sitePath(address) === wanted) return true;
  }
  return false;
}
