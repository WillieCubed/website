import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import { MicropubRequestError } from '@/lib/indieweb/micropub/document-types';
import type {
  MicropubCreateRequest,
  MicropubJsonBody,
  MicropubPhoto,
  MicropubPostType,
  MicropubPostTypeSource,
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
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new Error('invalid_request');
  const properties = validateProperties(body.properties ?? {});
  const types = body.type ?? ['h-entry'];
  if (
    !Array.isArray(types) ||
    !types.every((value) => typeof value === 'string')
  )
    throw new Error('invalid_request');
  const content = contentValue(properties.content);
  for (const property of [
    'in-reply-to',
    'like-of',
    'repost-of',
    'bookmark-of',
    'syndication',
  ])
    urlValues(properties[property], property);
  if (properties.content)
    properties.content = properties.content.map((value) =>
      typeof value === 'object' && typeof value.html === 'string'
        ? { ...value, html: sanitizeCommentHtml(value.html, site.origin) }
        : value
    );
  const postStatus = firstJsonString(properties['post-status']);
  if (
    postStatus !== undefined &&
    postStatus !== 'draft' &&
    postStatus !== 'published'
  )
    throw new Error('invalid_request');
  return normalizeEntry({
    h: types[0]?.replace(/^h-/, '') ?? 'entry',
    properties,
    content: content.body,
    contentFormat: content.format,
    postStatus,
    audio: urlValues(properties.audio, 'audio'),
    video: urlValues(properties.video, 'video'),
    event: types.includes('h-event')
      ? {
          start: firstJsonString(properties.start),
          end: firstJsonString(properties.end),
          location: properties.location?.[0],
        }
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
    for (const candidate of [url, value]) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return photoUrl(candidate);
      }
    }
  }
  throw new Error('invalid_request');
}
function parseFormData(formData: FormData): MicropubCreateRequest {
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
  const properties = Object.fromEntries(collected);
  for (const property of [
    'in-reply-to',
    'like-of',
    'repost-of',
    'bookmark-of',
    'syndication',
  ])
    urlValues(properties[property], property);
  if (properties.category)
    properties.category = formStringList(formData, 'category');
  const content = contentValue(properties.content);
  const postStatus = optionalFormString(formData.get('post-status'));
  if (
    postStatus !== undefined &&
    postStatus !== 'draft' &&
    postStatus !== 'published'
  )
    throw new Error('invalid_request');
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
function normalizeEntry(entry: RawMicropubEntry): MicropubCreateRequest {
  const content = entry.content?.trim() ?? '';
  // A photo post may be the photo alone, without a caption.
  if (
    !['entry', 'event'].includes(entry.h) ||
    (!content &&
      entry.photos.length === 0 &&
      !entry.audio?.length &&
      !entry.video?.length &&
      !entry.likeOf &&
      !entry.repostOf &&
      !entry.bookmarkOf &&
      !entry.inReplyTo &&
      entry.h !== 'event')
  ) {
    throw new Error('invalid_request');
  }
  assertPhotoAlts(entry.photos);
  if (entry.rsvp && !entry.inReplyTo)
    throw new MicropubRequestError(
      'An RSVP needs in-reply-to naming the event.'
    );
  if (
    entry.h === 'event' &&
    !entry.name &&
    !entry.content &&
    !entry.event?.start
  )
    throw new MicropubRequestError(
      'An event needs a name, content, or start time.'
    );
  for (const date of [entry.event?.start, entry.event?.end])
    if (date !== undefined && Number.isNaN(new Date(date).getTime()))
      throw new MicropubRequestError('Event dates must be valid dates.');

  return {
    h: entry.h as 'entry' | 'event',
    properties: entry.properties,
    contentFormat: entry.contentFormat,
    postStatus: entry.postStatus,
    audio: entry.audio,
    video: entry.video,
    event: entry.event,
    content,
    name: entry.name,
    summary: entry.summary,
    categories: entry.categories.filter(Boolean),
    slug: entry.slug,
    published: entry.published,
    postType: inferPostType(entry),
    inReplyTo: entry.inReplyTo,
    likeOf: entry.likeOf,
    repostOf: entry.repostOf,
    bookmarkOf: entry.bookmarkOf,
    rsvp: normalizeRsvp(entry.rsvp),
    photos: entry.photos,
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
function inferPostType(entry: MicropubPostTypeSource): MicropubPostType {
  if (entry.rsvp) return 'rsvp';
  if (entry.likeOf) return 'like';
  if (entry.repostOf) return 'repost';
  if (entry.bookmarkOf) return 'bookmark';
  if (entry.inReplyTo) return 'reply';
  if (entry.event) return 'event';
  if (entry.video?.length) return 'video';
  if (entry.audio?.length) return 'audio';
  if (entry.photos?.length) return 'photo';
  return entry.name ? 'article' : 'note';
}
function normalizeRsvp(
  value: string | undefined
): MicropubRsvpStatus | undefined {
  if (
    value === 'yes' ||
    value === 'no' ||
    value === 'maybe' ||
    value === 'interested'
  ) {
    return value;
  }
  if (value !== undefined)
    throw new MicropubRequestError(
      'rsvp is one of yes, no, maybe, or interested.'
    );
  return undefined;
}
function validateProperties(
  value: unknown
): Record<string, (string | Record<string, unknown>)[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid_request');
  return Object.fromEntries(
    Object.entries(value).map(([key, values]) => {
      if (
        !Array.isArray(values) ||
        !values.every(
          (item) =>
            typeof item === 'string' ||
            (item && typeof item === 'object' && !Array.isArray(item))
        )
      )
        throw new Error('invalid_request');
      return [key, values];
    })
  );
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
