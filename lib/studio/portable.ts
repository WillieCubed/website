/** Author review is tied to this exact instance's content and configuration. */
export function portableReview(attrs: Record<string, unknown>) {
  return structuredClone({
    id: attrs.id,
    version: attrs.version,
    instance: attrs.instance ?? null,
    props: attrs.props ?? {},
    portable: attrs.portable ?? '',
  });
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export function portableReviewed(attrs: Record<string, unknown>): boolean {
  return (
    typeof attrs.portable === 'string' &&
    Boolean(attrs.portable.trim()) &&
    canonical(attrs.portableReview) === canonical(portableReview(attrs))
  );
}
