import matter from 'gray-matter';

import { hasImageDescription } from '@/lib/accessibility/alt-policy';
import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import {
  resolveSyndicationTargets,
  syndicationName,
} from '@/lib/indieweb/syndication';
import { site } from '@/lib/site';

/*
 * A writing file seen as a Micropub post: its frontmatter and body read as
 * mf2 properties for q=source, and edited in place for an update. An edit
 * rewrites only the frontmatter keys whose values change and keeps every
 * other byte, so hand-written formatting, comments, line endings, and keys
 * Micropub knows nothing about (series, featured, featuredImage) survive.
 */

/** A request this server understood but cannot carry out, answered with 400. */
export class MicropubRequestError extends Error {
  constructor(readonly description: string) {
    super('invalid_request');
    this.name = 'MicropubRequestError';
  }
}

export type Mf2Value = string | { [key: string]: unknown };
export type Mf2Properties = Record<string, Mf2Value[]>;

export interface Mf2Entry {
  type?: string[];
  properties: Mf2Properties;
}

/** A Micropub update, with `delete` split into its two forms. */
export interface MicropubUpdate {
  replace: Mf2Properties;
  add: Mf2Properties;
  /** Properties to remove whole: `"delete": ["category"]`. */
  deleteProperties: string[];
  /** Values to remove: `"delete": { "category": ["indieweb"] }`. */
  deleteValues: Mf2Properties;
}

/** Single-valued frontmatter keys holding a URL, by mf2 property. */
const URL_KEYS = [
  ['in-reply-to', 'inReplyTo'],
  ['like-of', 'likeOf'],
  ['repost-of', 'repostOf'],
  ['bookmark-of', 'bookmarkOf'],
] as const;

const RSVP_STATUSES = new Set(['yes', 'no', 'maybe', 'interested']);

type Frontmatter = Record<string, unknown>;

interface Block {
  /** The top-level key this block sets; absent for comments and blank lines. */
  key?: string;
  /** Each line with its own line ending. */
  lines: string[];
}

interface WritingFile {
  /** The opening fence with its line ending, verbatim. */
  open: string;
  blocks: Block[];
  /** The closing fence with its line ending, verbatim. */
  close: string;
  /** Everything after the closing fence, verbatim. */
  body: string;
  /** The line ending the file uses, for the lines an edit writes. */
  eol: string;
}

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

  const file = splitWritingFile(source);
  const { data } = readWritingSource(source);
  const current = sourceProperties(data, file.body);
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

  if (next.content) next.content = sanitizeContentValues(next.content);
  for (const key of Object.keys(next))
    if (next[key].length === 0) delete next[key];
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

/**
 * A date the way the hand-written posts spell it: local to the site's time
 * zone with a numeric offset, such as `2026-09-27T13:05-0700`. YAML reads
 * that as a string rather than a timestamp, the same as the posts Willie
 * writes, and the writings loader parses both.
 */
export function siteTimestamp(date: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: site.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
      timeZoneName: 'longOffset',
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value])
  );
  const offset = parts.timeZoneName.replace('GMT', '').replace(':', '');
  const seconds = parts.second === '00' ? '' : `:${parts.second}`;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}${seconds}${offset || '+0000'}`;
}

function sourceProperties(data: Frontmatter, body: string): Mf2Properties {
  const properties: Mf2Properties = {};
  const put = (name: string, values: Mf2Value[]) => {
    if (values.length > 0) properties[name] = values;
  };
  const rsvp = rsvpOf(data);
  put('name', text(data.title));
  put('summary', text(data.description));
  put(
    'content',
    data.contentFormat === 'html' && body.trim()
      ? [{ html: body.trim() }]
      : text(body)
  );
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
  put(
    'syndication',
    syndicationOf(data).map(({ url }) => url)
  );
  put('post-status', [isDraft(data) ? 'draft' : 'published']);
  put(
    'mp-syndicate-to',
    Array.isArray(data.syndicateTo)
      ? data.syndicateTo.filter((value) => typeof value === 'string')
      : []
  );
  put(
    'audio',
    Array.isArray(data.audio)
      ? data.audio.filter((value) => typeof value === 'string')
      : []
  );
  put(
    'video',
    Array.isArray(data.video)
      ? data.video.filter((value) => typeof value === 'string')
      : []
  );
  const event = data.event as Record<string, unknown> | undefined;
  if (event) {
    put('start', text(event.start));
    put('end', text(event.end));
    if (event.location !== undefined)
      put('location', [event.location as Mf2Value]);
  }
  const mf2 = data.micropub as { properties?: Mf2Properties } | undefined;
  if (mf2?.properties && !Object.hasOwn(mf2.properties, 'name'))
    delete properties.name;
  return Object.fromEntries(
    Object.entries({ ...properties, ...(mf2?.properties ?? {}) }).filter(
      ([, values]) => Array.isArray(values) && values.length
    )
  );
}

function writeProperties(
  file: WritingFile,
  data: Frontmatter,
  next: Mf2Properties,
  touched: Set<string>
) {
  if (touched.has('name')) {
    setString(file, data, 'title', single(next.name, 'name'));
  }
  if (touched.has('summary')) {
    setString(file, data, 'description', single(next.summary, 'summary'));
  }
  if (touched.has('content')) writeContent(file, data, next.content ?? []);
  if (touched.has('published')) {
    const published = single(next.published, 'published');
    if (!published) {
      throw new MicropubRequestError('A post needs a published date.');
    }
    setDate(file, data, 'published', published);
  }
  if (touched.has('category')) writeCategory(file, data, next.category ?? []);
  for (const [property, key] of URL_KEYS) {
    if (!touched.has(property)) continue;
    const urls = (next[property] ?? []).map((value) =>
      webUrl(citationUrl(value), property)
    );
    setString(file, data, key, urls[0]);
  }
  if (touched.has('rsvp') || (touched.has('in-reply-to') && data.rsvp)) {
    writeRsvp(file, data, next);
  }
  if (touched.has('photo')) writePhotos(file, data, next.photo ?? []);
  if (touched.has('syndication')) {
    writeSyndication(file, data, next.syndication ?? []);
  }
  if (touched.has('mp-syndicate-to')) {
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
      targets.length ? [`syndicateTo: ${JSON.stringify(targets)}`] : null
    );
  }
  for (const name of ['audio', 'video']) {
    if (!touched.has(name)) continue;
    const urls = (next[name] ?? []).map((value) =>
      webUrl(citationUrl(value), name)
    );
    if (!sameJson(urls, data[name] ?? []))
      setKey(
        file,
        name,
        urls.length ? [`${name}: ${JSON.stringify(urls)}`] : null
      );
  }
  if (['start', 'end', 'location'].some((name) => touched.has(name))) {
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
  if (touched.has('post-status')) {
    const status = single(next['post-status'], 'post-status');
    if (status !== 'draft' && status !== 'published') {
      throw new MicropubRequestError(
        'post-status is either "draft" or "published".'
      );
    }
    const draft = status === 'draft';
    if (draft !== isDraft(data)) setKey(file, 'draft', [`draft: ${draft}`]);
  }
}

function postTypeForProperties(
  properties: Mf2Properties,
  types?: string[]
): string {
  if (properties.rsvp?.length) return 'rsvp';
  if (properties['like-of']?.length) return 'like';
  if (properties['repost-of']?.length) return 'repost';
  if (properties['bookmark-of']?.length) return 'bookmark';
  if (properties['in-reply-to']?.length) return 'note';
  if (
    types?.includes('h-event') ||
    properties.start?.length ||
    properties.end?.length ||
    properties.location?.length
  )
    return 'event';
  if (properties.video?.length) return 'video';
  if (properties.audio?.length) return 'audio';
  if (properties.photo?.length) return 'photo';
  return properties.name?.length ? 'article' : 'note';
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
  else if (value && typeof value.html === 'string') {
    content = value.html;
    format = 'html';
  } else if (value && typeof value.value === 'string') content = value.value;
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
  if (!sameJson(people, peopleOf(data))) {
    setKey(
      file,
      'people',
      people.length > 0 ? mapList('people', people) : null
    );
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
  const eventUrl = next['in-reply-to']?.[0]
    ? citationUrl(next['in-reply-to'][0])
    : undefined;
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
  if (sameJson(photos, photosOf(data))) return;
  setKey(file, 'photo', photos.length > 0 ? mapList('photo', photos) : null);
}

// A copy already listed keeps the name its author gave it.
function writeSyndication(
  file: WritingFile,
  data: Frontmatter,
  values: Mf2Value[]
) {
  const existing = syndicationOf(data);
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
  setKey(
    file,
    'syndication',
    links.length > 0 ? mapList('syndication', links) : null
  );
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

// The writings loader hides any post whose `draft` is truthy, so this reads
// it the same way.
function isDraft(data: Frontmatter): boolean {
  return Boolean(data.draft);
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

function syndicationOf(data: Frontmatter): { name?: string; url: string }[] {
  return listOf(data.syndication).flatMap(({ name, url }) => {
    if (typeof url !== 'string') return [];
    return [typeof name === 'string' ? { name, url } : { url }];
  });
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

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mapList(key: string, items: Record<string, string | undefined>[]) {
  return [
    `${key}:`,
    ...items.flatMap((item) =>
      Object.entries(item)
        .filter(([, value]) => value !== undefined)
        .map(
          ([field, value], index) =>
            `${index === 0 ? '  - ' : '    '}${field}: ${JSON.stringify(value)}`
        )
    ),
  ];
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

const FRONTMATTER = /^(---[ \t]*(\r?\n))((?:[^\n]*\n)*?)(---[ \t]*(?:\r?\n|$))/;

function splitWritingFile(source: string): WritingFile {
  const match = FRONTMATTER.exec(source);
  if (!match) {
    throw new MicropubRequestError('The post has no frontmatter to edit.');
  }
  const [whole, open, eol, frontmatter, close] = match;
  return {
    open,
    blocks: frontmatterBlocks(frontmatter.match(/[^\n]*\n/g) ?? []),
    close,
    body: source.slice(whole.length),
    eol,
  };
}

/**
 * Split frontmatter into one block per top-level key, with its indented or
 * list lines, and a block per comment or blank line between them. A blank
 * line inside a block scalar stays with its key.
 */
function frontmatterBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let blanks: string[] = [];
  const flush = () => {
    blocks.push(...blanks.map((line) => ({ lines: [line] })));
    blanks = [];
  };
  for (const line of lines) {
    const content = line.replace(/\r?\n$/, '');
    const key = /^([A-Za-z_][\w-]*)[ \t]*:(?:[ \t]|$)/.exec(content)?.[1];
    const last = blocks.at(-1);
    if (key) {
      flush();
      blocks.push({ key, lines: [line] });
    } else if (content.trim() === '') {
      blanks.push(line);
    } else if (/^[ \t-]/.test(content) && last?.key) {
      last.lines.push(...blanks, line);
      blanks = [];
    } else {
      flush();
      blocks.push({ lines: [line] });
    }
  }
  flush();
  return blocks;
}

function joinWritingFile({ open, blocks, close, body }: WritingFile): string {
  return `${open}${blocks.flatMap((block) => block.lines).join('')}${close}${body}`;
}

/** Replace a key's lines where they are, append a new key, or remove it. */
function setKey(file: WritingFile, key: string, lines: string[] | null) {
  const index = file.blocks.findIndex((block) => block.key === key);
  if (lines === null) {
    if (index !== -1) file.blocks.splice(index, 1);
    return;
  }
  const block = { key, lines: lines.map((line) => `${line}${file.eol}`) };
  if (index !== -1) file.blocks[index] = block;
  else file.blocks.push(block);
}

// An edit that the loader could not read would break the next build, so it
// never leaves this module.
function checked(source: string): string {
  try {
    const { data } = matter(source, {});
    const index = photosOf(data).findIndex(
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
