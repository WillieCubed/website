import type { ResponseGroup } from '@/lib/indieweb/webmention/types';

export const emptyResponses = (): ResponseGroup => ({
  likes: [],
  reposts: [],
  replies: [],
  mentions: [],
  bookmarks: [],
  rsvps: [],
});
export function mergeResponses(
  indieweb: ResponseGroup | null,
  atmosphere: ResponseGroup
): ResponseGroup {
  const output = emptyResponses();
  const aliases = new Map<string, string>();
  const canonical = (url: string) => {
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      return parsed.href.replace(/\/$/, '');
    } catch {
      return url;
    }
  };
  for (const response of Object.values(atmosphere).flat()) {
    for (const url of [response.sourceUrl, ...(response.sourceAliases ?? [])])
      aliases.set(canonical(url), canonical(response.sourceUrl));
  }
  for (const key of Object.keys(output) as (keyof ResponseGroup)[]) {
    const seen = new Set<string>();
    output[key] = [...(indieweb?.[key] ?? []), ...atmosphere[key]].filter(
      (response) => {
        const source = canonical(
          response.type === 'like' || response.type === 'repost'
            ? (response.author.url ?? response.sourceUrl)
            : response.sourceUrl
        );
        const identity = `${response.type}:${aliases.get(source) ?? source}`;
        if (seen.has(identity)) return false;
        seen.add(identity);
        return true;
      }
    );
  }
  return output;
}
