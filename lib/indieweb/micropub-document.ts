import matter from 'gray-matter';

/*
 * A writing file seen as a Micropub post: its frontmatter and body read as
 * mf2 properties for q=source.
 */

export type Mf2Value = string | { [key: string]: unknown };
export type Mf2Properties = Record<string, Mf2Value[]>;

export interface Mf2Entry {
  type?: string[];
  properties: Mf2Properties;
}

type Frontmatter = Record<string, unknown>;

/**
 * The post as a q=source answer. With no properties requested it carries
 * every property and the type; with some, only those, as the spec asks.
 */
export function micropubSource(
  source: string,
  url: string,
  requested: string[] = []
): Mf2Entry {
  const { data, content } = readWritingSource(source);
  const properties: Mf2Properties = {
    ...sourceProperties(data, content),
    url: [url],
  };
  if (requested.length === 0) return { type: ['h-entry'], properties };
  return {
    properties: Object.fromEntries(
      requested
        .filter((name) => Object.hasOwn(properties, name))
        .map((name) => [name, properties[name]])
    ),
  };
}

function sourceProperties(data: Frontmatter, body: string): Mf2Properties {
  const properties: Mf2Properties = {};
  const put = (name: string, values: Mf2Value[]) => {
    if (values.length > 0) properties[name] = values;
  };
  const rsvp = rsvpOf(data);
  put('name', text(data.title));
  put('summary', text(data.description));
  put('content', text(body));
  put('published', text(isoDate(data.published)));
  put('updated', text(isoDate(data.lastUpdated)));
  put('category', [...tagsOf(data), ...peopleOf(data).map(hCard)]);
  put('in-reply-to', text(data.inReplyTo ?? rsvp?.eventUrl));
  put('like-of', text(data.likeOf));
  put('repost-of', text(data.repostOf));
  put('bookmark-of', text(data.bookmarkOf));
  put('rsvp', text(rsvp?.status));
  put(
    'photo',
    photosOf(data).map(({ url, alt }) => (alt ? { value: url, alt } : url))
  );
  put('syndication', syndicationOf(data));
  put('post-status', [data.draft === true ? 'draft' : 'published']);
  return properties;
}

function hCard({ name, url }: { name: string; url: string }): Mf2Value {
  return { type: ['h-card'], properties: { name: [name], url: [url] } };
}

function text(value: unknown): string[] {
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  return trimmed ? [trimmed] : [];
}

// YAML reads a timestamp with seconds as a Date and the site's usual
// `2026-09-20T08:00-0700` as a string; both come back in UTC.
function isoDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function tagsOf(data: Frontmatter): string[] {
  return Array.isArray(data.tags) ? data.tags.map(String) : [];
}

function peopleOf(data: Frontmatter): { name: string; url: string }[] {
  return listOf(data.people).flatMap(({ name, url }) =>
    typeof name === 'string' && typeof url === 'string' ? [{ name, url }] : []
  );
}

function photosOf(data: Frontmatter): { url: string; alt?: string }[] {
  return (Array.isArray(data.photo) ? data.photo : []).flatMap(
    (item: unknown) => {
      if (typeof item === 'string') return item ? [{ url: item }] : [];
      if (!item || typeof item !== 'object') return [];
      const { url, alt } = item as Record<string, unknown>;
      if (typeof url !== 'string' || !url) return [];
      return [typeof alt === 'string' && alt ? { url, alt } : { url }];
    }
  );
}

function syndicationOf(data: Frontmatter): string[] {
  return listOf(data.syndication).flatMap(({ url }) =>
    typeof url === 'string' ? [url] : []
  );
}

function rsvpOf(
  data: Frontmatter
): { eventUrl: string; status: string } | undefined {
  const rsvp = data.rsvp as Record<string, unknown> | undefined;
  return rsvp &&
    typeof rsvp.eventUrl === 'string' &&
    typeof rsvp.status === 'string'
    ? { eventUrl: rsvp.eventUrl, status: rsvp.status }
    : undefined;
}

function listOf(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === 'object'
      )
    : [];
}

// Passing options keeps gray-matter from caching the parse, which would hand
// every caller one shared data object.
function readWritingSource(source: string): {
  data: Frontmatter;
  content: string;
} {
  const { data, content } = matter(source, {});
  return { data: data as Frontmatter, content };
}
