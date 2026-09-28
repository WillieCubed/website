import { readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  GitHubContentsCommitResponse,
  MicropubRouteEnvironment,
} from '@/lib/indieweb/types';
import { site } from '@/lib/site';

/*
 * Where Micropub reads and writes writing files: GitHub's Contents API when
 * MICROPUB_GITHUB_REPO and MICROPUB_GITHUB_TOKEN are set, so every change is
 * a commit the normal deploy picks up, and the local checkout otherwise.
 */

/** Thrown when a Micropub post cannot be stored anywhere durable. */
export class MicropubStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MicropubStorageError';
  }
}

/** One file written with one commit. */
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
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(slug) ? slug : null;
}

/**
 * The writing file a permalink names, or null when the URL is not a writing
 * on this site or no file exists. The `.mdx` file wins over a `.md` one, as
 * in the writings loader.
 */
export async function findStoredWriting(
  url: string,
  environment: MicropubRouteEnvironment,
  fetchImpl: typeof fetch = fetch
): Promise<StoredWriting | null> {
  const slug = writingSlugForUrl(url);
  if (!slug) return null;
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
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  if (usesGitHub(environment)) {
    return putGitHubFile(
      { path: writing.path, content: source, message, sha: writing.sha },
      environment,
      fetchImpl
    );
  }
  try {
    await writeFile(localPath(writing.path), source, 'utf8');
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
  fetchImpl: typeof fetch = fetch
): Promise<string> {
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
 * The storage error for a failed local write. A read-only deploy (Vercel,
 * Workers) fails here, and the message says how to fix that.
 */
export function localWriteError(
  error: unknown,
  path: string,
  verb = 'write'
): MicropubStorageError {
  if (error instanceof MicropubStorageError) return error;
  const code = (error as NodeJS.ErrnoException).code;
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
  return new MicropubStorageError(
    `GitHub Contents API failed: ${response.status} ${await response.text()}`
  );
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
