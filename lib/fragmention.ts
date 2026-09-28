/**
 * Fragmentions (https://indieweb.org/fragmention): a URL ending in
 * `##some+words` points at the first place those words appear on the page.
 * These are the pure halves; components/site/Fragmention.tsx applies them.
 */

/**
 * The words a location hash names, or null when it is not a fragmention.
 * `location.hash` keeps its own `#`, so a fragmention arrives as `##…`.
 * `+` is a space, as in a query string, and the rest is percent-decoded.
 */
export function fragmentionWords(hash: string): string | null {
  if (!hash.startsWith('##')) return null;
  const raw = hash.slice(2).replace(/\+/g, ' ');
  let words: string;
  try {
    words = decodeURIComponent(raw);
  } catch {
    // A stray `%` is a typo in a shared link, not a reason to give up.
    words = raw;
  }
  words = words.replace(/\s+/g, ' ').trim();
  return words || null;
}

/**
 * Where the words sit in one text, ignoring case, as [start, end) offsets
 * into the original string. Any run of whitespace in the text matches one
 * space in the words, because prose wraps lines wherever its source did.
 */
export function findWords(
  text: string,
  words: string
): [start: number, end: number] | null {
  const pattern = words
    .split(' ')
    .filter(Boolean)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+');
  if (!pattern) return null;
  const match = new RegExp(pattern, 'iu').exec(text);
  return match ? [match.index, match.index + match[0].length] : null;
}
