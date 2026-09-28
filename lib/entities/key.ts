import { tagPath } from '@/lib/writings/tags';

/**
 * Normalises any in-site href to the registry key form: the path alone,
 * without origin, query, hash, or trailing slash. The one query kept is the
 * homepage's `?detail=`, because each detail view has its own card, and
 * `/writings?tag=` keys as the tag page it redirects to. Kept free of server
 * imports so client components can use it.
 */
export function entityKey(href: string): string {
  let url = href;
  if (/^https?:\/\//.test(href)) {
    try {
      const parsed = new URL(href);
      url = parsed.pathname + parsed.search;
    } catch {
      return href;
    }
  }
  const [beforeHash] = url.split('#');
  const [pathPart, query = ''] = beforeHash.split('?');
  let path = pathPart;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  path ||= '/';
  const params = new URLSearchParams(query);
  const detail = path === '/' ? params.get('detail') : null;
  if (detail) return `/?detail=${detail}`;
  const tag = path === '/writings' ? params.get('tag') : null;
  return tag ? tagPath(tag) : path;
}
