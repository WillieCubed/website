import { site } from '@/lib/site';

export function propertyText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.value === 'string') return item.value;
  const properties = item.properties as Record<string, unknown[]> | undefined;
  return properties && propertyText(properties.name?.[0]);
}

export function propertyUrl(value: unknown): string | undefined {
  const item =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : undefined;
  const properties = item?.properties as Record<string, unknown[]> | undefined;
  const candidate = properties
    ? propertyText(properties.url?.[0])
    : propertyText(value);
  try {
    if (
      !candidate ||
      (!candidate.startsWith('/') && !/^https?:\/\//i.test(candidate))
    )
      return undefined;
    const url = new URL(candidate, site.origin);
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
