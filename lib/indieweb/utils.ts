/**
 * Small, shared IndieWeb utilities.
 *
 * Route handlers and protocol helpers should use these instead of each file
 * growing its own date, URL, slug, or form parsing helpers.
 */

export function makeIndieWebSlug(
  text: string,
  fallbackPrefix = 'note'
): string {
  const slug = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  return slug || `${fallbackPrefix}-${Date.now()}`;
}

export function plainTextExcerpt(text: string, maxLength = 180): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}

export function optionalFormString(
  value: FormDataEntryValue | null
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function parseOptionalDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function firstString(values: string[] | undefined): string | undefined {
  return values?.[0];
}

export function formStringList(formData: FormData, key: string): string[] {
  const values = [...formData.getAll(key), ...formData.getAll(`${key}[]`)];
  return values.flatMap((value) =>
    String(value)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

export function absoluteSiteUrl(path: string, siteUrl: string): string {
  return new URL(path, siteUrl).toString();
}
