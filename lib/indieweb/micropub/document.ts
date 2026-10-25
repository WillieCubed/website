import matter from 'gray-matter';
import { z } from 'zod';

import { hasImageDescription } from '@/lib/accessibility/alt-policy';
import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import type {
  Frontmatter,
  Mf2Entry,
  Mf2Properties,
  Mf2Value,
  MicropubUpdate,
  WritingFile,
} from '@/lib/indieweb/micropub/document-types';
import { MicropubRequestError } from '@/lib/indieweb/micropub/document-types';
import {
  joinWritingFile,
  mapList,
  readWritingSource,
  setKey,
  splitWritingFile,
} from '@/lib/indieweb/micropub/frontmatter';
import {
  resolveSyndicationTargets,
  syndicationName,
} from '@/lib/indieweb/syndication';
import { site } from '@/lib/site/identity';
import { siteTimestamp } from '@/lib/site/timestamp';

/** Single-valued frontmatter keys holding a URL, by mf2 property. */
const URL_KEYS = [
  ['in-reply-to', 'inReplyTo'],
  ['like-of', 'likeOf'],
  ['repost-of', 'repostOf'],
  ['bookmark-of', 'bookmarkOf'],
] as const;
const RSVP_STATUSES = new Set(['yes', 'no', 'maybe', 'interested']);
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
  const mf2 = data.micropub as { type?: string[] } | undefined;
  if (requested.length === 0)
    return { type: mf2?.type ?? ['h-entry'], properties };
  return {
    properties: Object.fromEntries(
      requested
        .filter((name) => Object.hasOwn(properties, name))
        .map((name) => [name, properties[name]])
    ),
  };
}
/**
 * Apply a Micropub update to a writing file. Returns the file unchanged when
 * the update changes nothing, so no empty commit is made. Otherwise
 * `lastUpdated` moves to `now`. The draft flag changes only when
 * post-status is replaced outright.
 */
export function applyMicropubUpdate(
  source: string,
  update: MicropubUpdate,
  now = new Date()
): string {
  const named = validateUpdate(update);

  const file = splitWritingFile(source);
  const { data } = readWritingSource(source);
  const current = sourceProperties(data, file.body);
  const next = updatedProperties(current, update);
  if (
    sameJson(next, current) &&
    (!named.includes('content') ||
      data.contentFormat === 'text' ||
      data.contentFormat === 'html')
  )
    return source;
  writeProperties(file, data, next, new Set(named));
  next.updated = [now.toISOString()];
  const original = data.micropub as { type?: string[] } | undefined;
  setString(
    file,
    data,
    'postType',
    postTypeForProperties(next, original?.type)
  );
  setKey(file, 'micropub', [
    `micropub: ${JSON.stringify({ type: original?.type ?? ['h-entry'], properties: next })}`,
  ]);
  if (joinWritingFile(file) === source) return source;
  setKey(file, 'lastUpdated', [`lastUpdated: ${siteTimestamp(now)}`]);
  return checked(joinWritingFile(file));
}
function sourceProperties(data: Frontmatter, body: string): Mf2Properties {
  const rsvp = rsvpOf(data);
  const draft = Boolean(data.draft);
  return mergeStoredProperties(
    data,
    nonEmptyProperties({
      name: text(data.title),
      summary: text(data.description),
      content:
        data.contentFormat === 'html' && body.trim()
          ? [{ html: body.trim() }]
          : text(body),
      published: text(isoDate(data.published)),
      updated: text(isoDate(data.lastUpdated)),
      category: [...tagsOf(data), ...readList(data.people, person).map(hCard)],
      'in-reply-to': text(data.inReplyTo ?? rsvp?.eventUrl),
      'like-of': text(data.likeOf),
      'repost-of': text(data.repostOf),
      'bookmark-of': text(data.bookmarkOf),
      rsvp: text(rsvp?.status),
      photo: readList(data.photo, photo).map(({ url, alt }) =>
        alt ? { value: url, alt } : url
      ),
      syndication: readList(data.syndication, syndication).map(
        ({ url }) => url
      ),
      'post-status': [draft ? 'draft' : 'published'],
      'mp-syndicate-to': readList(data.syndicateTo, z.string()),
      audio: readList(data.audio, z.string()),
      video: readList(data.video, z.string()),
      ...eventSourceProperties(data),
    })
  );
}
function writeProperties(
  file: WritingFile,
  data: Frontmatter,
  next: Mf2Properties,
  touched: Set<string>
) {
  const writers: Record<string, () => void> = {
    name: () => setString(file, data, 'title', single(next.name, 'name')),
    summary: () =>
      setString(file, data, 'description', single(next.summary, 'summary')),
    content: () => writeContent(file, data, next.content ?? []),
    published: () => writePublished(file, data, next),
    category: () => writeCategory(file, data, next.category ?? []),
    photo: () => writePhotos(file, data, next.photo ?? []),
    syndication: () => writeSyndication(file, data, next.syndication ?? []),
    'mp-syndicate-to': () => writeSyndicationTargets(file, next),
  };
  for (const name of ['name', 'summary', 'content', 'published', 'category']) {
    if (touched.has(name)) writers[name]();
  }
  writeCitations(file, data, next, touched);
  for (const name of ['photo', 'syndication', 'mp-syndicate-to']) {
    if (touched.has(name)) writers[name]();
  }
  writeMediaUrls(file, data, next, touched);
  if (['start', 'end', 'location'].some((name) => touched.has(name)))
    writeEvent(file, next);
  if (touched.has('post-status')) writePostStatus(file, data, next);
}
function writePublished(
  file: WritingFile,
  data: Frontmatter,
  next: Mf2Properties
) {
  const published = single(next.published, 'published');
  if (!published) {
    throw new MicropubRequestError('A post needs a published date.');
  }
  setDate(file, data, 'published', published);
}
function writeSyndicationTargets(file: WritingFile, next: Mf2Properties) {
  const values = next['mp-syndicate-to'] ?? [];
  if (values.some((value) => typeof value !== 'string'))
    throw new MicropubRequestError(
      'Each mp-syndicate-to value needs a target URL.'
    );
  const targets = resolveSyndicationTargets(values as string[]).map(
    ({ uid }) => uid
  );
  setKey(
    file,
    'syndicateTo',
    targets.length > 0 ? [`syndicateTo: ${JSON.stringify(targets)}`] : null
  );
}
function writeEvent(file: WritingFile, next: Mf2Properties) {
  const event = {
    start: single(next.start, 'start'),
    end: single(next.end, 'end'),
    location: next.location?.[0],
  };
  for (const date of [event.start, event.end])
    if (date !== undefined && Number.isNaN(new Date(date).getTime()))
      throw new MicropubRequestError('Event dates must be valid dates.');
  setKey(file, 'event', [`event: ${JSON.stringify(event)}`]);
}
function writePostStatus(
  file: WritingFile,
  data: Frontmatter,
  next: Mf2Properties
) {
  const status = single(next['post-status'], 'post-status');
  if (status !== 'draft' && status !== 'published') {
    throw new MicropubRequestError(
      'post-status is either "draft" or "published".'
    );
  }
  const draft = status === 'draft';
  if (draft !== Boolean(data.draft)) setKey(file, 'draft', [`draft: ${draft}`]);
}
function writeMediaUrls(
  file: WritingFile,
  data: Frontmatter,
  next: Mf2Properties,
  touched: Set<string>
) {
  for (const name of ['audio', 'video']) {
    if (!touched.has(name)) continue;
    const urls = (next[name] ?? []).map((value) =>
      webUrl(citationUrl(value), name)
    );
    if (!sameJson(urls, data[name] ?? []))
      setKey(
        file,
        name,
        urls.length > 0 ? [`${name}: ${JSON.stringify(urls)}`] : null
      );
  }
}

function postTypeForProperties(
  properties: Mf2Properties,
  types?: string[]
): string {
  const citations = [
    ['rsvp', 'rsvp'],
    ['like-of', 'like'],
    ['repost-of', 'repost'],
    ['bookmark-of', 'bookmark'],
    ['in-reply-to', 'note'],
  ] as const;
  for (const [property, type] of citations)
    if ((properties[property]?.length ?? 0) > 0) return type;
  if (
    types?.includes('h-event') ||
    ['start', 'end', 'location'].some(
      (name) => (properties[name]?.length ?? 0) > 0
    )
  )
    return 'event';
  return mediaPostType(properties);
}
/** The primary content value is literal text or sanitized HTML, never MDX. */
function writeContent(
  file: WritingFile,
  data: Frontmatter,
  values: Mf2Value[]
) {
  const [value] = values;
  let content = '',
    format = 'text';
  if (typeof value === 'string') content = value;
  else if (value != null && typeof value.html === 'string') {
    content = value.html;
    format = 'html';
  } else if (value != null && typeof value.value === 'string')
    content = value.value;
  else if (value !== undefined)
    throw new MicropubRequestError('Content needs text, value, or html.');
  const lines = content.trim().replace(/\r?\n/g, '\n');
  if (
    lines === file.body.trim().replace(/\r?\n/g, '\n') &&
    data.contentFormat === format
  )
    return;
  setKey(file, 'contentFormat', [`contentFormat: ${JSON.stringify(format)}`]);
  file.body = lines
    ? `${file.eol}${lines.replace(/\n/g, file.eol)}${file.eol}`
    : file.eol;
}
function sanitizeContentValues(values: Mf2Value[]): Mf2Value[] {
  return values.map((value) =>
    typeof value === 'object' && typeof value.html === 'string'
      ? { ...value, html: sanitizeCommentHtml(value.html, site.origin) }
      : value
  );
}
function citationUrl(value: Mf2Value): string {
  if (typeof value === 'string') return value;
  const properties = value.properties as { url?: unknown[] } | undefined;
  const url = properties?.url?.[0] ?? value.value;
  if (typeof url === 'string') return url;
  throw new MicropubRequestError(
    'A citation needs a URL or an embedded item with a URL.'
  );
}
function writeCategory(
  file: WritingFile,
  data: Frontmatter,
  values: Mf2Value[]
) {
  const tags = [
    ...new Set(values.filter((value) => typeof value === 'string')),
  ];
  const people = values
    .filter((value) => typeof value !== 'string')
    .filter(
      (value) => Array.isArray(value.type) && value.type.includes('h-card')
    )
    .map(personFromCard);
  if (!sameJson(tags, tagsOf(data))) {
    setKey(file, 'tags', [`tags: ${JSON.stringify(tags)}`]);
  }
  if (!sameJson(people, readList(data.people, person))) {
    setKey(file, 'people', mapList('people', people));
  }
}
function writeRsvp(file: WritingFile, data: Frontmatter, next: Mf2Properties) {
  const status = single(next.rsvp, 'rsvp');
  if (!status) {
    if (data.rsvp !== undefined) setKey(file, 'rsvp', null);
    return;
  }
  if (!RSVP_STATUSES.has(status)) {
    throw new MicropubRequestError(
      'rsvp is one of "yes", "no", "maybe", or "interested".'
    );
  }
  const replyTarget = next['in-reply-to']?.[0];
  const eventUrl =
    replyTarget == null || replyTarget === ''
      ? undefined
      : citationUrl(replyTarget);
  if (!eventUrl) {
    throw new MicropubRequestError(
      'An RSVP needs in-reply-to naming the event.'
    );
  }
  const rsvp = { eventUrl: webUrl(eventUrl, 'in-reply-to'), status };
  if (sameJson(rsvp, rsvpOf(data))) return;
  setKey(file, 'rsvp', [
    'rsvp:',
    `  eventUrl: ${JSON.stringify(rsvp.eventUrl)}`,
    `  status: ${JSON.stringify(rsvp.status)}`,
  ]);
}
function writePhotos(file: WritingFile, data: Frontmatter, values: Mf2Value[]) {
  const photos = values.map((value) => {
    if (typeof value === 'string') return { url: webUrl(value, 'photo') };
    const { value: url, alt } = value;
    if (typeof url !== 'string') {
      throw new MicropubRequestError('Each photo needs a URL.');
    }
    const text = typeof alt === 'string' ? alt.trim() : '';
    return text
      ? { url: webUrl(url, 'photo'), alt: text }
      : { url: webUrl(url, 'photo') };
  });
  if (sameJson(photos, readList(data.photo, photo))) return;
  setKey(file, 'photo', mapList('photo', photos));
}
// A copy already listed keeps the name its author gave it.
function writeSyndication(
  file: WritingFile,
  data: Frontmatter,
  values: Mf2Value[]
) {
  const existing = readList(data.syndication, syndication);
  const links = values.map((value) => {
    if (typeof value !== 'string') {
      throw new MicropubRequestError('Each syndication value is a URL.');
    }
    const url = webUrl(value, 'syndication');
    const name =
      existing.find((link) => link.url === url)?.name ?? syndicationName(url);
    return { name, url };
  });
  if (sameJson(links, existing)) return;
  setKey(file, 'syndication', mapList('syndication', links));
}
function personFromCard(value: Mf2Value): { name: string; url: string } {
  const properties =
    typeof value === 'object' && value.properties
      ? (value.properties as Record<string, unknown>)
      : {};
  const name = Array.isArray(properties.name) ? properties.name[0] : undefined;
  const url = Array.isArray(properties.url) ? properties.url[0] : undefined;
  if (typeof name !== 'string' || !name.trim() || typeof url !== 'string') {
    throw new MicropubRequestError(
      'A person in category is an h-card with a name and a url.'
    );
  }
  return { name: name.trim(), url: webUrl(url, 'category') };
}
function hCard({ name, url }: { name: string; url: string }): Mf2Value {
  return { type: ['h-card'], properties: { name: [name], url: [url] } };
}
function setString(
  file: WritingFile,
  data: Frontmatter,
  key: string,
  value: string | undefined
) {
  const current = typeof data[key] === 'string' ? data[key] : undefined;
  const trimmed = value?.trim() || undefined;
  if (trimmed === current || (!trimmed && data[key] === undefined)) return;
  setKey(file, key, trimmed ? [`${key}: ${JSON.stringify(trimmed)}`] : null);
}
function setDate(
  file: WritingFile,
  data: Frontmatter,
  key: string,
  value: string
) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new MicropubRequestError(`"${value}" is not a date.`);
  }
  if (isoDate(data[key]) === date.toISOString()) return;
  setKey(file, key, [`${key}: ${siteTimestamp(date)}`]);
}
/** The one value of a property the frontmatter holds once, if any. */
function single(values: Mf2Value[] | undefined, name: string) {
  if (!values || values.length === 0) return undefined;
  if (typeof values[0] !== 'string') {
    throw new MicropubRequestError(`The property "${name}" takes text.`);
  }
  return values[0];
}
function webUrl(value: string, name: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {
    // Falls through to the rejection below.
  }
  throw new MicropubRequestError(
    `The ${name} value "${value}" is not a web URL.`
  );
}
/** What makes two values the same for add and delete: a photo or person by URL. */
function valueKey(value: Mf2Value, property: string): string {
  if (typeof value === 'string') return value;
  if (property !== 'photo' && property !== 'category')
    return JSON.stringify(value);
  if (typeof value.value === 'string') return value.value;
  const url = (value.properties as { url?: unknown[] } | undefined)?.url?.[0];
  return typeof url === 'string' ? url : JSON.stringify(value);
}
function uniqueValues(values: Mf2Value[], property: string): Mf2Value[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = valueKey(value, property);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
const person = z.object({ name: z.string(), url: z.string() });
const photo = z.union([
  z
    .string()
    .min(1)
    .transform((url) => ({ url, alt: undefined })),
  z.object({
    url: z.string().min(1),
    alt: z.string().min(1).optional().catch(undefined),
  }),
]);
const syndication = z.object({
  name: z.string().optional().catch(undefined),
  url: z.string(),
});

function readList<T>(value: unknown, schema: z.ZodType<T>): T[] {
  return (Array.isArray(value) ? value : []).flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}
const rsvp = z.object({ eventUrl: z.string(), status: z.string() });
function rsvpOf(
  data: Frontmatter
): { eventUrl: string; status: string } | undefined {
  const parsed = rsvp.safeParse(data.rsvp);
  return parsed.success ? parsed.data : undefined;
}
function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
// An edit that the loader could not read would break the next build, so it
// never leaves this module.
function checked(source: string): string {
  try {
    const { data } = matter(source, {});
    const index = readList(data.photo, photo).findIndex(
      (photo) => !hasImageDescription(photo.alt)
    );
    if (index >= 0) {
      throw new MicropubRequestError(
        `Photo ${index + 1} needs nonblank alt text. Send each photo as a JSON object with value and alt.`
      );
    }
  } catch (error) {
    if (error instanceof MicropubRequestError) throw error;
    throw new MicropubRequestError(
      'The update would leave frontmatter the writings loader cannot read.'
    );
  }
  return source;
}

function validateUpdate(update: MicropubUpdate): string[] {
  const named = [
    ...Object.keys(update.replace),
    ...Object.keys(update.add),
    ...update.deleteProperties,
    ...Object.keys(update.deleteValues),
  ];
  if (named.length === 0) {
    throw new MicropubRequestError('An update needs replace, add, or delete.');
  }
  const unsupported = named.find((name) =>
    ['updated', 'url', 'access_token', 'mp-slug'].includes(name)
  );
  if (unsupported) {
    throw new MicropubRequestError(
      `The property "${unsupported}" cannot be updated on this site.`
    );
  }
  if (
    Object.hasOwn(update.add, 'post-status') ||
    Object.hasOwn(update.deleteValues, 'post-status') ||
    update.deleteProperties.includes('post-status')
  ) {
    throw new MicropubRequestError(
      'Replace post-status with "draft" or "published"; it cannot be added or deleted.'
    );
  }

  return named;
}
function updatedProperties(
  current: Mf2Properties,
  update: MicropubUpdate
): Mf2Properties {
  const next: Mf2Properties = Object.assign(Object.create(null), current);
  for (const [name, values] of Object.entries(update.replace)) {
    next[name] = values;
  }
  for (const [name, values] of Object.entries(update.add)) {
    next[name] = uniqueValues([...(next[name] ?? []), ...values], name);
  }
  for (const name of update.deleteProperties) next[name] = [];
  for (const [name, values] of Object.entries(update.deleteValues)) {
    const drop = new Set(values.map((value) => valueKey(value, name)));
    next[name] = (next[name] ?? []).filter(
      (value) => !drop.has(valueKey(value, name))
    );
  }

  if (next.content != null) next.content = sanitizeContentValues(next.content);
  for (const key of Object.keys(next))
    if (next[key].length === 0) delete next[key];
  return next;
}

function writeCitations(
  file: WritingFile,
  data: Frontmatter,
  next: Mf2Properties,
  touched: Set<string>
) {
  for (const [property, key] of URL_KEYS) {
    if (!touched.has(property)) continue;
    const urls = (next[property] ?? []).map((value) =>
      webUrl(citationUrl(value), property)
    );
    setString(file, data, key, urls[0]);
  }
  if (touched.has('rsvp') || (touched.has('in-reply-to') && data.rsvp))
    writeRsvp(file, data, next);
}

function eventSourceProperties(data: Frontmatter): Mf2Properties {
  const event = data.event as Record<string, unknown> | undefined;
  return event
    ? nonEmptyProperties({
        start: text(event.start),
        end: text(event.end),
        location:
          event.location === undefined ? [] : [event.location as Mf2Value],
      })
    : {};
}
function nonEmptyProperties(properties: Mf2Properties): Mf2Properties {
  return Object.fromEntries(
    Object.entries(properties).filter(
      ([, values]) => Array.isArray(values) && values.length > 0
    )
  );
}
function mediaPostType(properties: Mf2Properties): string {
  for (const type of ['video', 'audio', 'photo'])
    if ((properties[type]?.length ?? 0) > 0) return type;
  return (properties.name?.length ?? 0) > 0 ? 'article' : 'note';
}

function mergeStoredProperties(
  data: Frontmatter,
  properties: Mf2Properties
): Mf2Properties {
  const mf2 = data.micropub as { properties?: Mf2Properties } | undefined;
  if (mf2?.properties && !Object.hasOwn(mf2.properties, 'name'))
    delete properties.name;
  return nonEmptyProperties({ ...properties, ...(mf2?.properties ?? {}) });
}
