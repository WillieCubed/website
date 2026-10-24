import { z } from 'zod';

import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import { MicropubRequestError } from '@/lib/indieweb/micropub/document-types';
import type {
  Mf2Properties,
  MicropubCreateRequest,
  MicropubEvent,
  MicropubJsonBody,
  MicropubPhoto,
  MicropubPostType,
  MicropubRsvpStatus,
  RawMicropubEntry,
} from '@/lib/indieweb/micropub/types';
import {
  MicropubValidationError,
  assertPhotoAlts,
  photoUrl,
} from '@/lib/indieweb/micropub/validation';
import { resolveSyndicationTargets } from '@/lib/indieweb/syndication';
import {
  formStringList,
  optionalFormString,
  parseOptionalDate,
} from '@/lib/indieweb/utils';
import { site } from '@/lib/site/identity';

export async function parseMicropubCreateRequest(
  request: Request
): Promise<MicropubCreateRequest> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return parseJsonBody((await request.json()) as MicropubJsonBody);
  }

  const formData = await request.formData();
  return parseFormData(formData);
}
function parseJsonBody(body: MicropubJsonBody): MicropubCreateRequest {
  if (body == null || typeof body !== 'object' || Array.isArray(body))
    throw new Error('invalid_request');
  const properties = validateProperties(body.properties ?? {});
  const types = body.type ?? ['h-entry'];
  if (!z.array(z.string()).safeParse(types).success)
    throw new Error('invalid_request');
  const content = contentValue(properties.content);
  validateCitations(properties);
  sanitizeContentProperties(properties);
  const postStatus = parsePostStatus(properties['post-status']);
  return normalizeEntry({
    h: types[0]?.replace(/^h-/, '') ?? 'entry',
    properties,
    content: content.body,
    contentFormat: content.format,
    postStatus,
    audio: urlValues(properties.audio, 'audio'),
    video: urlValues(properties.video, 'video'),
    event: types.includes('h-event')
      ? readEventProperties(properties)
      : undefined,
    name: firstJsonString(properties.name),
    summary: firstJsonString(properties.summary),
    categories: jsonStrings(properties.category),
    slug: firstJsonString(properties['mp-slug']),
    published: validDate(firstJsonString(properties.published)),
    inReplyTo: citedUrl(properties['in-reply-to']),
    likeOf: citedUrl(properties['like-of']),
    repostOf: citedUrl(properties['repost-of']),
    bookmarkOf: citedUrl(properties['bookmark-of']),
    rsvp: firstJsonString(properties.rsvp),
    photos: parseJsonPhotos(properties.photo),
    syndication: urlValues(properties.syndication, 'syndication'),
    syndicateTo: jsonStrings(properties['mp-syndicate-to']),
  });
}
// A JSON property is an array whose values may be strings or objects, such
// as `{ html }` content or an h-card category. These keep the strings only.
function jsonStrings(values: unknown[] | undefined): string[] {
  return (values ?? []).filter(
    (value): value is string => typeof value === 'string'
  );
}
function firstJsonString(values: unknown[] | undefined): string | undefined {
  const [first] = values ?? [];
  return typeof first === 'string'
    ? first
    : first &&
        typeof first === 'object' &&
        'value' in first &&
        typeof first.value === 'string'
      ? first.value
      : undefined;
}
/**
 * The address a citation property names. A client may send the URL itself
 * or embed the cited post as an h-cite, whose address is its `url` property;
 * mf2 JSON also carries the address as the embedded item's `value`. An object
 * that names no address is a bad request, not a post that silently loses
 * what it answers.
 */
function citedUrl(values: unknown[] | undefined): string | undefined {
  const [first] = values ?? [];
  if (first === undefined) return undefined;
  if (typeof first === 'string')
    return first.trim() ? photoUrl(first) : undefined;
  if (first && typeof first === 'object') {
    const { properties, value } = first as {
      properties?: { url?: unknown };
      value?: unknown;
    };
    const [url] = Array.isArray(properties?.url) ? properties.url : [];
    const candidate = [url, value].find(
      (item) => typeof item === 'string' && item.trim().length > 0
    );
    if (typeof candidate === 'string') return photoUrl(candidate);
  }
  throw new Error('invalid_request');
}
function parseFormData(formData: FormData): MicropubCreateRequest {
  const properties = collectFormProperties(formData);
  validateCitations(properties);
  if (properties.category != null)
    properties.category = formStringList(formData, 'category');
  const content = contentValue(properties.content);
  const postStatus = parsePostStatus(formData.getAll('post-status'));
  return normalizeEntry({
    properties,
    contentFormat: content.format,
    postStatus,
    audio: urlValues(properties.audio, 'audio'),
    video: urlValues(properties.video, 'video'),
    event:
      formData.get('h') === 'event'
        ? {
            start: firstJsonString(properties.start),
            end: firstJsonString(properties.end),
            location: properties.location?.[0],
          }
        : undefined,
    h: String(formData.get('h') ?? 'entry'),
    content: content.body,
    name: optionalFormString(formData.get('name')),
    summary: optionalFormString(formData.get('summary')),
    categories: formStringList(formData, 'category'),
    slug: optionalFormString(formData.get('mp-slug')),
    published: validDate(optionalFormString(formData.get('published'))),
    inReplyTo: optionalFormString(formData.get('in-reply-to')),
    likeOf: optionalFormString(formData.get('like-of')),
    repostOf: optionalFormString(formData.get('repost-of')),
    bookmarkOf: optionalFormString(formData.get('bookmark-of')),
    rsvp: optionalFormString(formData.get('rsvp')),
    photos: parseFormPhotos(formData),
    syndication: formStringList(formData, 'syndication'),
    syndicateTo: formStringList(formData, 'mp-syndicate-to'),
  });
}

function parsePostStatus(
  values: unknown[] | undefined
): 'draft' | 'published' | undefined {
  if (values === undefined) return undefined;
  if (!Array.isArray(values))
    throw new MicropubValidationError(
      'post-status must be an array of one status.'
    );
  if (values.length === 0) return undefined;
  if (
    values.length !== 1 ||
    !['draft', 'published'].includes(String(values[0]))
  ) {
    throw new MicropubValidationError(
      'post-status must be draft or published.'
    );
  }
  return values[0] as 'draft' | 'published';
}

function normalizeEntry(entry: RawMicropubEntry): MicropubCreateRequest {
  const content = entry.content?.trim() ?? '';
  validateEntry(entry, content);

  return {
    ...entry,
    h: entry.h as 'entry' | 'event',
    content,
    categories: entry.categories.filter(Boolean),
    postType: inferPostType(entry),
    rsvp: normalizeRsvp(entry.rsvp),
    syndication: entry.syndication.filter(Boolean),
    syndicateTo: resolveSyndicationTargets(entry.syndicateTo),
  };
}
function parseFormPhotos(formData: FormData): MicropubPhoto[] {
  if (formData.has('photo') || formData.has('photo[]')) {
    throw new MicropubValidationError(
      'Upload the file to /micropub/media if needed, then create the post with a JSON photo object containing value and alt.'
    );
  }
  return [];
}
// JSON bodies give each photo as a URL or as `{ value, alt }`.
function parseJsonPhotos(values: unknown): MicropubPhoto[] {
  if (values === undefined) return [];
  if (!Array.isArray(values)) throw new Error('invalid_request');
  return values.map((value: unknown) => {
    if (typeof value === 'string') return { url: photoUrl(value) };
    if (value && typeof value === 'object' && 'value' in value) {
      const { value: url, alt } = value as { value: unknown; alt?: unknown };
      if (typeof url !== 'string') throw new Error('invalid_request');
      const text = typeof alt === 'string' ? alt.trim() : '';
      return text ? { url: photoUrl(url), alt: text } : { url: photoUrl(url) };
    }
    throw new Error('invalid_request');
  });
}
function inferPostType(entry: RawMicropubEntry): MicropubPostType {
  const candidates: [unknown, MicropubPostType][] = [
    [entry.rsvp, 'rsvp'],
    [entry.likeOf, 'like'],
    [entry.repostOf, 'repost'],
    [entry.bookmarkOf, 'bookmark'],
    [entry.inReplyTo, 'reply'],
    [entry.event, 'event'],
    [entry.video?.length, 'video'],
    [entry.audio?.length, 'audio'],
    [entry.photos?.length, 'photo'],
    [entry.name, 'article'],
  ];
  return candidates.find(([value]) => Boolean(value))?.[1] ?? 'note';
}
function normalizeRsvp(
  value: string | undefined
): MicropubRsvpStatus | undefined {
  if (value === undefined) return undefined;
  if (['yes', 'no', 'maybe', 'interested'].includes(value))
    return value as MicropubRsvpStatus;
  throw new MicropubRequestError(
    'rsvp is one of yes, no, maybe, or interested.'
  );
}

const propertySchema = z.array(
  z.tuple([
    z.string(),
    z.array(z.union([z.string(), z.record(z.string(), z.unknown())])),
  ])
);
function validateProperties(value: unknown): Mf2Properties {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid_request');
  const entries = Object.entries(value);
  if (!propertySchema.safeParse(entries).success)
    throw new Error('invalid_request');
  // Validate entries rather than record keys so extension names such as
  // __proto__ survive without becoming setters on the retained property bag.
  return Object.fromEntries(entries) as Mf2Properties;
}

function validateCitations(properties: Mf2Properties): void {
  for (const name of [
    'in-reply-to',
    'like-of',
    'repost-of',
    'bookmark-of',
    'syndication',
  ])
    urlValues(properties[name], name);
}

function contentValue(
  values: (string | Record<string, unknown>)[] | undefined
): { body: string; format: 'text' | 'html' } {
  const value = values?.[0];
  if (value === undefined) return { body: '', format: 'text' };
  if (typeof value === 'string') return { body: value, format: 'text' };
  if (typeof value.html === 'string')
    return {
      body: sanitizeCommentHtml(value.html, site.origin),
      format: 'html',
    };
  if (typeof value.value === 'string')
    return { body: value.value, format: 'text' };
  throw new Error('invalid_request');
}
function urlValues(
  values: (string | Record<string, unknown>)[] | undefined,
  name: string
): string[] {
  return (values ?? []).map((value) => {
    const url = citedUrl([value]);
    if (!url) throw new MicropubRequestError(`Each ${name} needs a URL.`);
    return photoUrl(url);
  });
}
function validDate(value: string | undefined): Date | undefined {
  if (value !== undefined && Number.isNaN(new Date(value).getTime()))
    throw new MicropubRequestError('published must be a valid date.');
  return parseOptionalDate(value);
}

function collectFormProperties(formData: FormData): Mf2Properties {
  const collected = new Map<string, (string | Record<string, unknown>)[]>();
  for (const [field, value] of formData) {
    if (['h', 'access_token', 'action', 'url'].includes(field)) continue;
    if (typeof value !== 'string') {
      if (field.startsWith('photo')) parseFormPhotos(formData);
      throw new MicropubRequestError(
        'Upload files to /micropub/media before creating the post.'
      );
    }
    const name = field.replace(/\[\]$/, '');
    if (name === 'content[html]') {
      collected.set('content', [
        { html: sanitizeCommentHtml(value, site.origin) },
      ]);
      continue;
    }
    collected.set(name, [...(collected.get(name) ?? []), value]);
  }
  return Object.fromEntries(collected);
}

function validateEntry(entry: RawMicropubEntry, content: string) {
  // A photo post may be the photo alone, without a caption.
  if (
    !['entry', 'event'].includes(entry.h) ||
    !hasEntryContent(entry, content)
  ) {
    throw new Error('invalid_request');
  }
  assertPhotoAlts(entry.photos);
  if (entry.rsvp && !entry.inReplyTo)
    throw new MicropubRequestError(
      'An RSVP needs in-reply-to naming the event.'
    );
  validateEvent(entry);
}

function hasEntryContent(entry: RawMicropubEntry, content: string): boolean {
  return [
    content,
    entry.photos.length,
    entry.audio?.length,
    entry.video?.length,
    entry.likeOf,
    entry.repostOf,
    entry.bookmarkOf,
    entry.inReplyTo,
    entry.h === 'event',
  ].some(Boolean);
}

function sanitizeContentProperties(properties: Mf2Properties) {
  if (properties.content != null)
    properties.content = properties.content.map((value) =>
      typeof value === 'object' && typeof value.html === 'string'
        ? { ...value, html: sanitizeCommentHtml(value.html, site.origin) }
        : value
    );
}

function validateEvent(entry: RawMicropubEntry): void {
  if (
    entry.h === 'event' &&
    !entry.name &&
    !entry.content &&
    !entry.event?.start
  )
    throw new MicropubRequestError(
      'An event needs a name, content, or start time.'
    );
  validateEventDates(entry.event);
}

function readEventProperties(properties: Mf2Properties): MicropubEvent {
  return {
    start: firstJsonString(properties.start),
    end: firstJsonString(properties.end),
    location: properties.location?.[0],
  };
}

function validateEventDates(event: RawMicropubEntry['event']): void {
  for (const date of [event?.start, event?.end])
    if (date !== undefined && Number.isNaN(new Date(date).getTime()))
      throw new MicropubRequestError('Event dates must be valid dates.');
}
