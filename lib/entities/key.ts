/**
 * Normalises any in-site href to the registry key form: the path alone,
 * without origin, query, hash, or trailing slash. Kept free of server
 * imports so client components can use it.
 */
export function entityKey(href: string): string {
  let path = href;
  if (/^https?:\/\//.test(href)) {
    try {
      path = new URL(href).pathname;
    } catch {
      return href;
    }
  }
  path = path.split(/[?#]/)[0];
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}
