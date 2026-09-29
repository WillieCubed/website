import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { MICROPUB_MEDIA_ENDPOINT } from '@/lib/indieweb/constants';
import {
  MediaUploadError,
  getMediaStore,
  storeMedia,
  validateMediaFile,
} from '@/lib/indieweb/media';
import type { MediaStore } from '@/lib/indieweb/media';
import { MicropubRequestError } from '@/lib/indieweb/micropub-document';
import {
  MicropubStorageError,
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

export async function prepareMicropubPhotoRequest(
  request: Request,
  store: MediaStore | null
): Promise<Request> {
  if (!request.headers.get('content-type')?.includes('multipart/form-data'))
    return request;
  const input = await request.formData();
  const output = new FormData();
  for (const [name, value] of input) {
    if ((name === 'photo' || name === 'photo[]') && value instanceof File) {
      if (!store)
        throw new MediaUploadError('Media uploads are not configured.');
      validateMediaFile(value);
      output.append(name, await storeMedia(value, store));
    } else {
      output.append(name, value);
    }
  }
  return new Request(request.url, { method: request.method, body: output });
}

export function buildMicropubWritingFile(
  entry: MicropubCreateRequest,
  slug: string
): string {
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
    'draft: false',
    `postType: ${JSON.stringify(toWritingPostType(entry))}`,
  ];

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
      if (alt) lines.push(`    alt: ${JSON.stringify(alt)}`);
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
      'mp-slug may use only letters, digits, hyphens, and underscores, and must start with a letter or digit.'
    );
  }
  const slug =
    entry.slug ||
    makeIndieWebSlug(
      entry.name || entry.content,
      entry.postType === 'photo' ? 'photo' : undefined
    );
  return { slug, path: `${contentPath}/${slug}.mdx` };
}

/**
 * Commit a Micropub entry through GitHub's Contents API so the post lands on
 * the same review and deploy path as a hand-authored writing.
 */
export async function commitMicropubWriting(
  entry: MicropubCreateRequest,
  options: MicropubCommitOptions
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
    }
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
      throw new MicropubStorageError(
        `A writing with slug "${slug}" already exists.`
      );
    }
    await writeFile(absolutePath, body, { encoding: 'utf8', flag: 'wx' });
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
  const properties = body.properties ?? {};
  return normalizeEntry({
    h: (body.type ?? ['h-entry'])[0]?.replace(/^h-/, '') ?? 'entry',
    content: firstJsonString(properties.content),
    name: firstJsonString(properties.name),
    summary: firstJsonString(properties.summary),
    categories: jsonStrings(properties.category),
    slug: firstJsonString(properties['mp-slug']),
    published: parseOptionalDate(firstJsonString(properties.published)),
    inReplyTo: citedUrl(properties['in-reply-to']),
    likeOf: citedUrl(properties['like-of']),
    repostOf: citedUrl(properties['repost-of']),
    bookmarkOf: citedUrl(properties['bookmark-of']),
    rsvp: firstJsonString(properties.rsvp),
    photos: parseJsonPhotos(properties.photo),
    syndication: jsonStrings(properties.syndication),
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
  return typeof first === 'string' ? first : undefined;
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
  if (typeof first === 'string') return first.trim() || undefined;
  if (first && typeof first === 'object') {
    const { properties, value } = first as {
      properties?: { url?: unknown };
      value?: unknown;
    };
    const [url] = Array.isArray(properties?.url) ? properties.url : [];
    for (const candidate of [url, value]) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  }
  throw new Error('invalid_request');
}

function parseFormData(formData: FormData): MicropubCreateRequest {
  return normalizeEntry({
    h: String(formData.get('h') ?? 'entry'),
    content: String(formData.get('content') ?? ''),
    name: optionalFormString(formData.get('name')),
    summary: optionalFormString(formData.get('summary')),
    categories: formStringList(formData, 'category'),
    slug: optionalFormString(formData.get('mp-slug')),
    published: parseOptionalDate(optionalFormString(formData.get('published'))),
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
  if (entry.h !== 'entry' || (!content && entry.photos.length === 0)) {
    throw new Error('invalid_request');
  }

  return {
    h: 'entry',
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

// Form bodies carry photo URLs only, as `photo` or `photo[]`. A file sent
// here instead of to the media endpoint is refused rather than dropped, so a
// post never publishes without the photo its author attached.
function parseFormPhotos(formData: FormData): MicropubPhoto[] {
  const values = [...formData.getAll('photo'), ...formData.getAll('photo[]')];
  return values.map((value) => {
    if (typeof value !== 'string') throw new Error('invalid_request');
    return { url: photoUrl(value) };
  });
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
  return `Note from ${formatDate(published)}`;
}

function formatDate(date: Date): string {
  return isoDateOnly(date);
}
