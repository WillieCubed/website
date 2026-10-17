import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { MICROPUB_MEDIA_ENDPOINT } from '@/lib/indieweb/constants';
import { getMediaStore } from '@/lib/indieweb/media';
import { MicropubRequestError } from '@/lib/indieweb/micropub/document-types';
import { buildMicropubWritingFile } from '@/lib/indieweb/micropub/serialize';
import {
  MicropubConflictError,
  MicropubStorageError,
  createLocalWriting,
  localWriteError,
  putGitHubFile,
} from '@/lib/indieweb/micropub/store';
import type {
  MicropubCommitOptions,
  MicropubCommitResult,
  MicropubConfigResponse,
  MicropubCreateRequest,
} from '@/lib/indieweb/micropub/types';
import { MicropubValidationError } from '@/lib/indieweb/micropub/validation';
import { getMicropubSyndicationTargets } from '@/lib/indieweb/syndication';
import {
  RESERVED_WRITING_SLUGS,
  isWritingSlug,
  makeIndieWebSlug,
} from '@/lib/indieweb/utils';
import { absoluteRoute } from '@/lib/site/urls';

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
  if (entry.postStatus === 'draft')
    throw new MicropubValidationError(
      'Drafts must be saved in private studio storage.'
    );
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
 * read-only deploy (a Worker) the write fails and the caller reports
 * that instead of pretending the post exists.
 */
export async function writeMicropubWritingLocally(
  entry: MicropubCreateRequest,
  contentPath = DEFAULT_CONTENT_PATH
): Promise<MicropubCommitResult> {
  if (entry.postStatus === 'draft')
    throw new MicropubValidationError(
      'Drafts must be saved in private studio storage.'
    );
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
