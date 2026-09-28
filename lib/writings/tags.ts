// No server imports here: `entityKey` runs in the browser and builds tag
// addresses with these helpers.
import type { WritingData } from './types';

/**
 * Tags match without regard to case, so `Note` and `note` share one page.
 * The lowercase spelling is the one the page, its feeds, and its card use.
 */
export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/** The tag a `[tag]` route segment names. */
export function tagFromParam(param: string): string {
  // A segment can arrive still percent-encoded. A tag holding a bare `%` is
  // not valid encoding, and it is taken as written rather than thrown on.
  try {
    return normalizeTag(decodeURIComponent(param));
  } catch {
    return normalizeTag(param);
  }
}

/** The tag's page, which its feeds hang off. */
export function tagPath(tag: string): string {
  return `/writings/tags/${encodeURIComponent(normalizeTag(tag))}`;
}

/**
 * A tag's three feeds, beside its page the way the writings feeds sit
 * beside /writings.
 */
export function tagFeedPaths(tag: string): {
  rss: string;
  atom: string;
  json: string;
} {
  const page = tagPath(tag);
  return {
    rss: `${page}/feed.xml`,
    atom: `${page}/feed/atom`,
    json: `${page}/feed/json`,
  };
}

/** "1 writing", "3 writings". */
export function writingCount(count: number): string {
  return `${count} ${count === 1 ? 'writing' : 'writings'}`;
}

export interface TagGroup {
  tag: string;
  /** The writings carrying the tag, in the order they were given. */
  writings: WritingData[];
}

/**
 * Every tag the given writings carry, in code-point order. Drafts count if
 * the caller passes them, so production callers pass published writings.
 */
export function groupByTag(writings: WritingData[]): TagGroup[] {
  const groups = new Map<string, WritingData[]>();
  for (const writing of writings) {
    for (const tag of new Set(writing.tags.map(normalizeTag))) {
      if (!tag) continue;
      groups.set(tag, [...(groups.get(tag) ?? []), writing]);
    }
  }
  return [...groups.keys()]
    .sort()
    .map((tag) => ({ tag, writings: groups.get(tag) ?? [] }));
}
