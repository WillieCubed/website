import type { PersonTag } from './types';

/**
 * Reads the `people` frontmatter list into person tags. An entry needs a
 * non-empty `name` and an absolute http(s) `url`, since the url is both the
 * tag's h-card identity and the webmention target; anything else is dropped
 * so one typo cannot break the page. Repeated urls keep their first entry.
 */
export function parsePersonTags(raw: unknown): PersonTag[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const people: PersonTag[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { name, url } = entry as Record<string, unknown>;
    if (typeof name !== 'string' || typeof url !== 'string') continue;
    const trimmedName = name.trim();
    const href = absoluteHttpUrl(url.trim());
    if (!trimmedName || !href || seen.has(href)) continue;
    seen.add(href);
    people.push({ name: trimmedName, url: href });
  }
  return people;
}

function absoluteHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.href
      : null;
  } catch {
    return null;
  }
}
