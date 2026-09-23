/**
 * Normalises any in-site href to the registry key form: the path alone,
 * without origin, query, hash, or trailing slash. The one query kept is the
 * homepage's `?detail=`, because each detail view has its own card. Kept free
 * of server imports so client components can use it.
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
  const detail = path === '/' ? new URLSearchParams(query).get('detail') : null;
  return detail ? `/?detail=${detail}` : path;
}
