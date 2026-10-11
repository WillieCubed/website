import matter from 'gray-matter';
import { randomUUID } from 'node:crypto';
import { link, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  GitHubContentsCommitResponse,
  MicropubRouteEnvironment,
} from '@/lib/indieweb/types';
import { isWritingSlug } from '@/lib/indieweb/utils';
import { site } from '@/lib/site';
import {
  documentSource,
  importMdx,
  parseDraftContent,
} from '@/lib/studio/document';
import { StudioError } from '@/lib/studio/errors';
import { getStudioStore } from '@/lib/studio/store';
import type { Draft, Publication, StudioStore } from '@/lib/studio/types';

/*
 * Private Micropub revisions live exclusively in studio storage. Existing
 * public files use GitHub's Contents API or the writable checkout when studio
 * storage is absent. A draft never falls back to either public backend.
 */

export interface PrivateMicropubOptions {
  /** Explicit dependency injection for tests; production requires STUDIO_DATABASE_URL. */
  studioStore?: StudioStore;
  publish?: (documentId: string, revisionId: string) => Promise<Publication>;
}

export function privateMicropubStore(
  options: PrivateMicropubOptions = {}
): StudioStore | null {
  return (
    options.studioStore ??
    (process.env.STUDIO_DATABASE_URL ? getStudioStore() : null)
  );
}

function privateSource(draft: Draft): string {
  const body = draft.head.body;
  const originalType = body.frontmatter?.postType;
  const postType =
    typeof originalType === 'string' &&
    !['article', 'note'].includes(originalType)
      ? originalType
      : body.postType;
  return matter.stringify(documentSource(body.document), {
    ...body.frontmatter,
    title: body.title,
    description: body.description,
    postType,
    tags: body.tags,
    draft: draft.head.id !== draft.liveRevisionId,
  });
}

export async function createPrivateMicropubWriting(
  slug: string,
  source: string,
  options: PrivateMicropubOptions = {}
): Promise<{ draft: Draft; commit: string }> {
  const store = privateMicropubStore(options);
  if (!store)
    throw new StudioError(503, 'Private draft storage is not configured.');
  const draft = await store.create(slug, parseDraftContent(importMdx(source)));
  const commit = matter(source).data.draft
    ? ''
    : await publishPrivate(draft, options);
  return { draft, commit };
}

async function publishPrivate(
  draft: Draft,
  options: PrivateMicropubOptions
): Promise<string> {
  const publish =
    options.publish ??
    (await import('@/lib/studio/publication')).publishRevision;
  return (await publish(draft.id, draft.head.id)).commit ?? '';
}

/** Thrown when a Micropub post cannot be stored anywhere durable. */
export class MicropubStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MicropubStorageError';
  }
}

/** One file written with one commit. */
export class MicropubConflictError extends MicropubStorageError {}

export interface GitHubFileWrite {
  path: string;
  content: string;
  message: string;
  /** The blob being replaced. Omitted for a new file. */
  sha?: string;
}

/** A writing file as storage holds it. */
export interface StoredWriting {
  slug: string;
  /** Repo-relative path, such as `content/writings/hello.mdx`. */
  path: string;
  source: string;
  /** The blob SHA GitHub needs to change the file; absent locally. */
  sha?: string;
  privateDocumentId?: string;
  privateRevisionId?: string;
}

/**
 * The slug of a writing permalink on this site, or null for any other URL.
 * The slug becomes part of a file path, so it is held to the characters a
 * slug is made of, which also keeps out `_` templates.
 */
export function writingSlugForUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.origin !== new URL(site.origin).origin) return null;
  const segment = /^\/writings\/([^/]+)\/?$/.exec(parsed.pathname)?.[1];
  if (!segment) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return isWritingSlug(slug) ? slug : null;
}

/**
 * The writing file a permalink names, or null when the URL is not a writing
 * on this site or no file exists. The `.mdx` file wins over a `.md` one, as
 * in the writings loader.
 */
export async function findStoredWriting(
  url: string,
  environment: MicropubRouteEnvironment,
  fetchImpl: typeof fetch = fetch,
  privateOptions: PrivateMicropubOptions = {}
): Promise<StoredWriting | null> {
  const slug = writingSlugForUrl(url);
  if (!slug) return null;
  const privateDraft = await privateMicropubStore(privateOptions)?.bySlug(slug);
  if (privateDraft)
    return {
      slug,
      path: `${environment.contentPath}/${slug}.mdx`,
      source: privateSource(privateDraft),
      privateDocumentId: privateDraft.id,
      privateRevisionId: privateDraft.head.id,
      sha: privateDraft.head.body.baseFileSha,
    };
  for (const extension of ['mdx', 'md']) {
    const path = `${environment.contentPath}/${slug}.${extension}`;
    const found = usesGitHub(environment)
      ? await readGitHubFile(path, environment, fetchImpl)
      : await readLocalFile(path);
    if (found) return { slug, path, ...found };
  }
  return null;
}

/**
 * Replace a writing file. On GitHub the write carries the SHA that was read,
 * so a file that changed in between fails instead of being overwritten.
 * Returns the commit SHA, or an empty string for a local write.
 */
export async function saveStoredWriting(
  writing: StoredWriting,
  source: string,
  message: string,
  environment: MicropubRouteEnvironment,
  fetchImpl: typeof fetch = fetch,
  privateOptions: PrivateMicropubOptions = {}
): Promise<string> {
  const isDraft = Boolean(matter(source).data.draft);
  const store = privateMicropubStore(privateOptions);
  if (isDraft || writing.privateDocumentId || store) {
    if (!store)
      throw new StudioError(503, 'Private draft storage is not configured.');
    const body = parseDraftContent(importMdx(source, writing.sha));
    const draft =
      writing.privateDocumentId && writing.privateRevisionId
        ? await store.save(
            writing.privateDocumentId,
            writing.privateRevisionId,
            body
          )
        : await store.create(writing.slug, body);
    return isDraft ? '' : publishPrivate(draft, privateOptions);
  }
  if (usesGitHub(environment)) {
    return putGitHubFile(
      { path: writing.path, content: source, message, sha: writing.sha },
      environment,
      fetchImpl
    );
  }
  try {
    await assertUnchanged(writing);
    const temporary = `${localPath(writing.path)}.${randomUUID()}.micropub`;
    try {
      await writeFile(temporary, source, { encoding: 'utf8', flag: 'wx' });
      await assertUnchanged(writing);
      await rename(temporary, localPath(writing.path));
    } finally {
      await unlink(temporary).catch(() => {});
    }
  } catch (error) {
    throw localWriteError(error, writing.path);
  }
  return '';
}

/**
 * Remove a writing file. On GitHub the delete carries the SHA that was read,
 * so a file that changed in between fails instead of losing that change.
 * Returns the commit SHA, or an empty string for a local delete.
 */
export async function deleteStoredWriting(
  writing: StoredWriting,
  message: string,
  environment: MicropubRouteEnvironment,
  fetchImpl: typeof fetch = fetch,
  privateOptions: PrivateMicropubOptions = {}
): Promise<string> {
  if (writing.privateDocumentId && writing.privateRevisionId) {
    const store = privateMicropubStore(privateOptions);
    if (!store)
      throw new StudioError(503, 'Private draft storage is not configured.');
    await store.remove(writing.privateDocumentId, writing.privateRevisionId);
    return '';
  }
  if (matter(writing.source).data.draft)
    throw new StudioError(
      503,
      'Import this draft into private storage before deleting it.'
    );
  if (usesGitHub(environment)) {
    const response = await fetchImpl(contentsUrl(writing.path, environment), {
      method: 'DELETE',
      headers: githubHeaders(environment),
      body: JSON.stringify({
        branch: environment.defaultBranch,
        message,
        sha: writing.sha,
      }),
    });
    if (!response.ok) throw await githubError(response);
    const data = (await response.json()) as GitHubContentsCommitResponse;
    return data.commit?.sha ?? '';
  }
  try {
    await assertUnchanged(writing);
    await unlink(localPath(writing.path));
  } catch (error) {
    throw localWriteError(error, writing.path, 'delete');
  }
  return '';
}

/** Create or replace one file with a commit, and return the commit SHA. */
export async function putGitHubFile(
  { path, content, message, sha }: GitHubFileWrite,
  environment: MicropubRouteEnvironment,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const response = await fetchImpl(contentsUrl(path, environment), {
    method: 'PUT',
    headers: githubHeaders(environment),
    body: JSON.stringify({
      branch: environment.defaultBranch,
      content: Buffer.from(content, 'utf8').toString('base64'),
      message,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!response.ok) throw await githubError(response);
  const data = (await response.json()) as GitHubContentsCommitResponse;
  return data.commit?.sha ?? '';
}

/**
 * The storage error for a failed local write. A read-only Worker fails here,
 * and the message says how to fix that.
 */
export function localWriteError(
  error: unknown,
  path: string,
  verb = 'write'
): MicropubStorageError {
  if (error instanceof MicropubStorageError) return error;
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'EEXIST')
    return new MicropubConflictError(
      'Another post already occupies this path.'
    );
  if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') {
    return new MicropubStorageError(
      `The content directory is read-only (${code}). Configure MICROPUB_GITHUB_REPO and MICROPUB_GITHUB_TOKEN so posts commit through GitHub instead.`
    );
  }
  return new MicropubStorageError(
    `Could not ${verb} ${path}: ${error instanceof Error ? error.message : String(error)}`
  );
}

function usesGitHub(
  environment: MicropubRouteEnvironment
): environment is MicropubRouteEnvironment & {
  githubRepository: string;
  githubToken: string;
} {
  return Boolean(environment.githubRepository && environment.githubToken);
}

function contentsUrl(
  path: string,
  environment: MicropubRouteEnvironment
): string {
  return `https://api.github.com/repos/${environment.githubRepository}/contents/${encodeURI(path)}`;
}

function githubHeaders(environment: MicropubRouteEnvironment): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${environment.githubToken}`,
    'Content-Type': 'application/json',
    'User-Agent': `${new URL(site.origin).hostname} micropub`,
  };
}

async function githubError(response: Response): Promise<MicropubStorageError> {
  const message = `GitHub Contents API failed: ${response.status} ${await response.text()}`;
  return response.status === 409 || response.status === 422
    ? new MicropubConflictError(message)
    : new MicropubStorageError(message);
}

async function readGitHubFile(
  path: string,
  environment: MicropubRouteEnvironment,
  fetchImpl: typeof fetch
): Promise<{ source: string; sha: string } | null> {
  const url = new URL(contentsUrl(path, environment));
  url.searchParams.set('ref', environment.defaultBranch);
  const response = await fetchImpl(url, {
    headers: githubHeaders(environment),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw await githubError(response);
  const data = (await response.json()) as { content?: string; sha?: string };
  if (typeof data.content !== 'string' || typeof data.sha !== 'string') {
    throw new MicropubStorageError(`GitHub returned no content for ${path}.`);
  }
  return {
    source: Buffer.from(data.content, 'base64').toString('utf8'),
    sha: data.sha,
  };
}

async function readLocalFile(path: string): Promise<{ source: string } | null> {
  try {
    return { source: await readFile(localPath(path), 'utf8') };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new MicropubStorageError(
      `Could not read ${path}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// The create path in micropub.ts already traces the whole project into the
// Micropub route, so this path needs no tracing of its own.
function localPath(path: string): string {
  return join(/*turbopackIgnore: true*/ process.cwd(), path);
}

async function assertUnchanged(writing: StoredWriting): Promise<void> {
  const current = await readLocalFile(writing.path);
  if (!current || current.source !== writing.source) {
    throw new MicropubConflictError(
      'The post changed after this request read it.'
    );
  }
}

/** Restore the exact archived source without overwriting another post. */
export async function restoreStoredWriting(
  writing: StoredWriting,
  environment: MicropubRouteEnvironment,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  if (writing.privateDocumentId || matter(writing.source).data.draft)
    throw new StudioError(
      503,
      'Restore private drafts through the writing studio; they cannot be written to the public content backend.'
    );
  if (usesGitHub(environment))
    return putGitHubFile(
      {
        path: writing.path,
        content: writing.source,
        message: `chore(content): Restore ${writing.slug} via Micropub`,
      },
      environment,
      fetchImpl
    );
  try {
    await createLocalWriting(writing.path, writing.source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new MicropubConflictError(
        'Another post already occupies the archived path.'
      );
    throw localWriteError(error, writing.path, 'restore');
  }
  return '';
}

/** A complete temporary file becomes visible only if the target is absent. */
export async function createLocalWriting(
  path: string,
  source: string
): Promise<void> {
  const target = localPath(path);
  const temporary = `${target}.${randomUUID()}.micropub`;
  try {
    await writeFile(temporary, source, { encoding: 'utf8', flag: 'wx' });
    await link(temporary, target);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}
