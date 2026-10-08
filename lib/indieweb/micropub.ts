import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { hasImageDescription } from '@/lib/accessibility/alt-policy';
import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import { MICROPUB_MEDIA_ENDPOINT } from '@/lib/indieweb/constants';
import { getMediaStore } from '@/lib/indieweb/media';
import { MicropubRequestError } from '@/lib/indieweb/micropub-document';
import {
  MicropubConflictError,
  MicropubStorageError,
  createLocalWriting,
  localWriteError,
  putGitHubFile,
} from '@/lib/indieweb/micropub-store';
import {
  getMicropubSyndicationTargets,
  resolveSyndicationTargets,
  syndicationName,
} from '@/lib/indieweb/syndication';
import type {
  MicropubCommitOptions,
  MicropubCommitResult,
  MicropubConfigResponse,
  MicropubCreateRequest,
  MicropubJsonBody,
  MicropubPhoto,
  MicropubPostType,
  MicropubPostTypeSource,
  MicropubRsvpStatus,
  RawMicropubEntry,
} from '@/lib/indieweb/types';
import {
  RESERVED_WRITING_SLUGS,
  formStringList,
  isWritingSlug,
  isoDateOnly,
  makeIndieWebSlug,
  optionalFormString,
  parseOptionalDate,
  plainTextExcerpt,
} from '@/lib/indieweb/utils';
import { absoluteRoute, site } from '@/lib/site';

const DEFAULT_CONTENT_PATH = 'content/writings';

export { MicropubStorageError, getMicropubSyndicationTargets };

export function getMicropubConfig(
  mediaAvailable = Boolean(getMediaStore())
): MicropubConfigResponse {
  return {
    ...(mediaAvailable
      ? { 'media-endpoint': absoluteRoute`${MICROPUB_MEDIA_ENDPOINT}` }
      : {}),
    'syndicate-to': getMicropubSyndicationTargets(),
    q: ['config', 'source', 'syndicate-to', 'category'],
    'post-types': [
      { type: 'note', name: 'Note' },
      { type: 'photo', name: 'Photo' },
      { type: 'article', name: 'Article' },
      { type: 'reply', name: 'Reply' },
      { type: 'like', name: 'Like' },
      { type: 'repost', name: 'Repost' },
      { type: 'bookmark', name: 'Bookmark' },
      { type: 'rsvp', name: 'RSVP' },
      { type: 'audio', name: 'Audio' },
      { type: 'video', name: 'Video' },
      { type: 'event', name: 'Event' },
    ],
  };
}

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

export function buildMicropubWritingFile(
  entry: MicropubCreateRequest,
  slug: string
): string {
  assertPhotoAlts(entry.photos);
  const published = entry.published ?? new Date();
  const title = entry.name ?? titleForEntry(entry, published);
  const description =
    entry.summary ??
    (plainTextExcerpt(entry.content) ||
      (entry.postType === 'photo'
        ? `A photo from ${site.author.givenName}.`
        : `A short note from ${site.author.givenName}.`));
  const lines = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `published: ${published.toISOString()}`,
    `lastUpdated: ${published.toISOString()}`,
    `tags: ${JSON.stringify(entry.categories)}`,
    `draft: ${entry.postStatus === 'draft'}`,
    `contentFormat: ${JSON.stringify(entry.contentFormat ?? 'text')}`,
    `micropub: ${JSON.stringify({ type: [entry.h === 'event' ? 'h-event' : 'h-entry'], properties: entry.properties ?? propertiesForEntry(entry) })}`,
    `postType: ${JSON.stringify(toWritingPostType(entry))}`,
  ];

  if (entry.audio?.length) lines.push(`audio: ${JSON.stringify(entry.audio)}`);
  if (entry.video?.length) lines.push(`video: ${JSON.stringify(entry.video)}`);
  if (entry.event) lines.push(`event: ${JSON.stringify(entry.event)}`);
  const people = (entry.properties?.category ?? []).flatMap((value) => {
    if (typeof value !== 'object') return [];
    if (!Array.isArray(value.type) || !value.type.includes('h-card')) return [];
    const props = value.properties as Record<string, unknown[]> | undefined;
    const name = props?.name?.[0],
      url = props?.url?.[0];
    return typeof name === 'string' && typeof url === 'string'
      ? [{ name: name.trim(), url: photoUrl(url) }]
      : [];
  });
  if (people.length) lines.push(`people: ${JSON.stringify(people)}`);

  if (entry.inReplyTo)
    lines.push(`inReplyTo: ${JSON.stringify(entry.inReplyTo)}`);
  if (entry.likeOf) lines.push(`likeOf: ${JSON.stringify(entry.likeOf)}`);
  if (entry.repostOf) lines.push(`repostOf: ${JSON.stringify(entry.repostOf)}`);
  if (entry.bookmarkOf) {
    lines.push(`bookmarkOf: ${JSON.stringify(entry.bookmarkOf)}`);
  }
  if (entry.photos.length > 0) {
    lines.push('photo:');
    entry.photos.forEach(({ url, alt }) => {
      lines.push(`  - url: ${JSON.stringify(url)}`);
      lines.push(`    alt: ${JSON.stringify(alt)}`);
    });
  }
  if (entry.rsvp && entry.inReplyTo) {
    lines.push('rsvp:');
    lines.push(`  eventUrl: ${JSON.stringify(entry.inReplyTo)}`);
    lines.push(`  status: ${JSON.stringify(entry.rsvp)}`);
  }
  const syndication = syndicationLinks(entry);
  if (syndication.length > 0) {
    lines.push('syndication:');
    syndication.forEach(({ name, url }) => {
      lines.push(`  - name: ${JSON.stringify(name)}`);
      lines.push(`    url: ${JSON.stringify(url)}`);
    });
  }
  if (entry.syndicateTo.length > 0) {
    lines.push(
      `syndicateTo: ${JSON.stringify(entry.syndicateTo.map(({ uid }) => uid))}`
    );
  }

  return `${lines.join('\n')}\n---\n\n${entry.content.trim()}\n`;
}

/**
 * Slug and repo-relative path for a new Micropub entry. The client's
 * mp-slug is checked here, where both the local write and the GitHub commit
 * get their path, so `../` can never leave the writings directory.
 */
export function micropubWritingPath(
  entry: MicropubCreateRequest,
  contentPath = DEFAULT_CONTENT_PATH
): { slug: string; path: string } {
  if (entry.slug !== undefined && !isWritingSlug(entry.slug)) {
    throw new MicropubRequestError(
      RESERVED_WRITING_SLUGS.has(entry.slug)
        ? `mp-slug "${entry.slug}" is taken by the /writings/${entry.slug} route.`
        : 'mp-slug may use only letters, digits, hyphens, and underscores, and must start with a letter or digit.'
    );
  }
  if (entry.slug)
    return { slug: entry.slug, path: `${contentPath}/${entry.slug}.mdx` };
  const made = makeIndieWebSlug(
    entry.name || entry.content,
    entry.postType === 'photo' ? 'photo' : undefined
  );
  // A made slug always has the right characters, so it fails only when a
  // note's whole text is a route name, such as a note that reads "Tags".
  const slug = isWritingSlug(made) ? made : `${made}-${Date.now()}`;
  return { slug, path: `${contentPath}/${slug}.mdx` };
}

/**
 * Commit a Micropub entry through GitHub's Contents API so the post lands on
 * the same review and deploy path as a hand-authored writing.
 */
export async function commitMicropubWriting(
  entry: MicropubCreateRequest,
  options: MicropubCommitOptions,
  fetchImpl: typeof fetch = fetch
): Promise<MicropubCommitResult> {
  const { slug, path } = micropubWritingPath(
    entry,
    options.contentPath || DEFAULT_CONTENT_PATH
  );
  const sha = await putGitHubFile(
    {
      path,
      content: buildMicropubWritingFile(entry, slug),
      message: `feat(writings): Publish ${slug} via Micropub`,
    },
    {
      githubRepository: options.repository,
      githubToken: options.token,
      defaultBranch: options.branch,
      contentPath: options.contentPath,
    },
    fetchImpl
  );

  return {
    sha,
    path,
    slug,
    location: absoluteRoute`/writings/${slug}`,
  };
}

/**
 * Write a Micropub entry straight into the content directory.
 *
 * This is the path for a self-hosted server with a writable checkout. On a
 * read-only deploy (Vercel, Workers) the write fails and the caller reports
 * that instead of pretending the post exists.
 */
export async function writeMicropubWritingLocally(
  entry: MicropubCreateRequest,
  contentPath = DEFAULT_CONTENT_PATH
): Promise<MicropubCommitResult> {
  const { slug, path } = micropubWritingPath(entry, contentPath);
  const absolutePath = join(process.cwd(), path);
  const body = buildMicropubWritingFile(entry, slug);

  try {
    await mkdir(join(process.cwd(), contentPath), { recursive: true });
    if (await exists(absolutePath)) {
      throw new MicropubConflictError(
        `A writing with slug "${slug}" already exists.`
      );
    }
    await createLocalWriting(path, body);
  } catch (error) {
    throw localWriteError(error, path);
  }

  return { sha: '', path, slug, location: absoluteRoute`/writings/${slug}` };
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
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

export class MicropubValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MicropubValidationError';
  }
}

function assertPhotoAlts(photos: readonly { alt?: unknown }[]): void {
  const index = photos.findIndex((photo) => !hasImageDescription(photo.alt));
  if (index >= 0) {
    throw new MicropubValidationError(
      `Photo ${index + 1} needs nonblank alt text. Send each photo as a JSON object with value and alt.`
    );
  }
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

function photoUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return url.toString();
    }
  } catch {
    // Falls through to the rejection below.
  }
  throw new Error('invalid_request');
}

// Only an already published copy may appear as a syndication link. A target
// from mp-syndicate-to is only intent until someone posts the copy.
function syndicationLinks(
  entry: MicropubCreateRequest
): { name: string; url: string }[] {
  const links = entry.syndication.map((url) => ({
    name: syndicationName(url),
    url,
  }));
  return links.filter(
    (link, index) => links.findIndex(({ url }) => url === link.url) === index
  );
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

// The writings loader treats "reply" as a note with inReplyTo set, so the
// stored postType collapses to note; the frontmatter keeps inReplyTo.
function toWritingPostType(entry: MicropubCreateRequest): string {
  return entry.postType === 'reply' ? 'note' : entry.postType;
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

function titleForEntry(entry: MicropubCreateRequest, published: Date): string {
  if (entry.postType === 'reply') return `Reply from ${formatDate(published)}`;
  if (entry.postType === 'like') return `Like from ${formatDate(published)}`;
  if (entry.postType === 'repost')
    return `Repost from ${formatDate(published)}`;
  if (entry.postType === 'bookmark') {
    return `Bookmark from ${formatDate(published)}`;
  }
  if (entry.postType === 'rsvp') return `RSVP from ${formatDate(published)}`;
  if (entry.postType === 'photo') {
    return `Photo from ${formatDate(published)}`;
  }
  if (['audio', 'video', 'event'].includes(entry.postType))
    return `${entry.postType[0].toUpperCase()}${entry.postType.slice(1)} from ${formatDate(published)}`;
  return `Note from ${formatDate(published)}`;
}

function formatDate(date: Date): string {
  return isoDateOnly(date);
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

function propertiesForEntry(
  entry: MicropubCreateRequest
): Record<string, (string | Record<string, unknown>)[]> {
  return Object.fromEntries(
    Object.entries({
      content: entry.content ? [entry.content] : [],
      name: entry.name ? [entry.name] : [],
      summary: entry.summary ? [entry.summary] : [],
      category: entry.categories,
      'in-reply-to': entry.inReplyTo ? [entry.inReplyTo] : [],
      'like-of': entry.likeOf ? [entry.likeOf] : [],
      'repost-of': entry.repostOf ? [entry.repostOf] : [],
      'bookmark-of': entry.bookmarkOf ? [entry.bookmarkOf] : [],
      rsvp: entry.rsvp ? [entry.rsvp] : [],
      photo: entry.photos.map(({ url, alt }) => ({ value: url, alt })),
      syndication: entry.syndication,
      audio: entry.audio ?? [],
      video: entry.video ?? [],
    }).filter(([, values]) => values.length)
  );
}

function validDate(value: string | undefined): Date | undefined {
  if (value !== undefined && Number.isNaN(new Date(value).getTime()))
    throw new MicropubRequestError('published must be a valid date.');
  return parseOptionalDate(value);
}
