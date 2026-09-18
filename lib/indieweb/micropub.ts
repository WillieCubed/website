import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  GitHubContentsCommitResponse,
  MicropubCommitOptions,
  MicropubCommitResult,
  MicropubConfigResponse,
  MicropubCreateRequest,
  MicropubJsonBody,
  MicropubPostType,
  MicropubPostTypeSource,
  MicropubRsvpStatus,
  RawMicropubEntry,
} from '@/lib/indieweb/types';
import {
  firstString,
  formStringList,
  isoDateOnly,
  makeIndieWebSlug,
  optionalFormString,
  parseOptionalDate,
  plainTextExcerpt,
} from '@/lib/indieweb/utils';
import { absoluteRoute, site } from '@/lib/site';

const DEFAULT_CONTENT_PATH = 'content/writings';

/** Thrown when a Micropub post cannot be stored anywhere durable. */
export class MicropubStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MicropubStorageError';
  }
}

export function getMicropubConfig(): MicropubConfigResponse {
  return {
    'media-endpoint': null,
    'syndicate-to': [],
    'post-types': [
      { type: 'note', name: 'Note' },
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

export function buildMicropubWritingFile(
  entry: MicropubCreateRequest,
  slug: string
): string {
  const published = entry.published ?? new Date();
  const title = entry.name ?? titleForEntry(entry, published);
  const description =
    entry.summary ??
    plainTextExcerpt(entry.content) ??
    `A short note from ${site.author.givenName}.`;
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
  if (entry.rsvp && entry.inReplyTo) {
    lines.push('rsvp:');
    lines.push(`  eventUrl: ${JSON.stringify(entry.inReplyTo)}`);
    lines.push(`  status: ${JSON.stringify(entry.rsvp)}`);
  }
  if (entry.syndication.length > 0) {
    lines.push('syndication:');
    entry.syndication.forEach((url) => {
      lines.push(`  - name: ${JSON.stringify(new URL(url).hostname)}`);
      lines.push(`    url: ${JSON.stringify(url)}`);
    });
  }

  return `${lines.join('\n')}\n---\n\n${entry.content.trim()}\n`;
}

/** Slug and repo-relative path for a new Micropub entry. */
export function micropubWritingPath(
  entry: MicropubCreateRequest,
  contentPath = DEFAULT_CONTENT_PATH
): { slug: string; path: string } {
  const slug = entry.slug || makeIndieWebSlug(entry.name || entry.content);
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
  const body = buildMicropubWritingFile(entry, slug);
  const response = await fetch(
    `https://api.github.com/repos/${options.repository}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
        'User-Agent': `${new URL(site.origin).hostname} micropub`,
      },
      body: JSON.stringify({
        branch: options.branch,
        content: Buffer.from(body, 'utf8').toString('base64'),
        message: `feat(writings): Publish ${slug} via Micropub`,
      }),
    }
  );

  if (!response.ok) {
    throw new MicropubStorageError(
      `GitHub Contents API failed: ${response.status} ${await response.text()}`
    );
  }

  const data = (await response.json()) as GitHubContentsCommitResponse;

  return {
    sha: data.commit?.sha ?? '',
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
    if (error instanceof MicropubStorageError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') {
      throw new MicropubStorageError(
        `The content directory is read-only (${code}). Configure MICROPUB_GITHUB_REPO and MICROPUB_GITHUB_TOKEN so posts commit through GitHub instead.`
      );
    }
    throw new MicropubStorageError(
      `Could not write ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
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
    content: firstString(properties.content),
    name: firstString(properties.name),
    summary: firstString(properties.summary),
    categories: properties.category ?? [],
    slug: firstString(properties['mp-slug']),
    published: parseOptionalDate(firstString(properties.published)),
    inReplyTo: firstString(properties['in-reply-to']),
    likeOf: firstString(properties['like-of']),
    repostOf: firstString(properties['repost-of']),
    bookmarkOf: firstString(properties['bookmark-of']),
    rsvp: firstString(properties.rsvp),
    syndication: properties.syndication ?? [],
  });
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
    syndication: formStringList(formData, 'syndication'),
  });
}

function normalizeEntry(entry: RawMicropubEntry): MicropubCreateRequest {
  const content = entry.content?.trim() ?? '';
  if (entry.h !== 'entry' || !content) {
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
    syndication: entry.syndication.filter(Boolean),
  };
}

function inferPostType(entry: MicropubPostTypeSource): MicropubPostType {
  if (entry.rsvp) return 'rsvp';
  if (entry.likeOf) return 'like';
  if (entry.repostOf) return 'repost';
  if (entry.bookmarkOf) return 'bookmark';
  if (entry.inReplyTo) return 'reply';
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
  return `Note from ${formatDate(published)}`;
}

function formatDate(date: Date): string {
  return isoDateOnly(date);
}
