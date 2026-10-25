/** GET and HEAD validators use weak comparison, including a wildcard match. */
export function matchesEntityTag(value: string | null, tag: string): boolean {
  const tags = value?.match(/(?:W\/)?"[^"]*"|\*/g) ?? [];
  return tags.some(
    (candidate) => candidate === '*' || candidate.replace(/^W\//, '') === tag
  );
}
