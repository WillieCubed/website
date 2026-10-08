import { site } from '@/lib/site';

import type { WritingData } from './types';

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

export function propertyLinks(
  writing: WritingData,
  property: string
): { url: string; name: string }[] {
  return (writing.micropub?.properties[property] ?? []).flatMap((value) => {
    const url = propertyUrl(value);
    return url
      ? [{ url, name: propertyText(value) || new URL(url).hostname }]
      : [];
  });
}

export function locationText(value: unknown): string | undefined {
  const name = propertyText(value);
  if (name) return name;
  if (!value || typeof value !== 'object') return undefined;
  const properties = (value as Record<string, unknown>).properties as
    | Record<string, unknown[]>
    | undefined;
  if (!properties) return undefined;
  const address = [
    'street-address',
    'locality',
    'region',
    'postal-code',
    'country-name',
  ]
    .map((key) => propertyText(properties[key]?.[0]))
    .filter(Boolean)
    .join(', ');
  if (address) return address;
  const latitude = propertyText(properties.latitude?.[0]);
  const longitude = propertyText(properties.longitude?.[0]);
  return latitude && longitude ? `${latitude}, ${longitude}` : undefined;
}
