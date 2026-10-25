import { getCloudflareContext } from '@opennextjs/cloudflare';
import matter from 'gray-matter';

import { HttpError } from '@/lib/http/errors';
import {
  documentSource,
  importMdx,
  parseDraftContent,
} from '@/lib/studio/document';
import { getStudioStore } from '@/lib/studio/store';
import type { Draft, Publication, StudioStore } from '@/lib/studio/types';

import type { StoredWriting } from './storage-types';

export interface PrivateMicropubOptions {
  /** Explicit dependency injection for tests; Workers use private Hyperdrive. */
  studioStore?: PrivateMicropubStore;
  publish?: (documentId: string, revisionId: string) => Promise<Publication>;
}

export type PrivateMicropubStore = Pick<
  StudioStore,
  'bySlug' | 'create' | 'save' | 'remove'
>;

export function privateMicropubStore(
  options: PrivateMicropubOptions = {}
): PrivateMicropubStore | null {
  if (options.studioStore) return options.studioStore;
  if (process.env.STUDIO_DATABASE_URL) return getStudioStore();
  try {
    if (getCloudflareContext().env.STUDIO_HYPERDRIVE) return getStudioStore();
  } catch {
    // Local runs without a private database keep their public file backend.
  }
  return null;
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

export interface PrivateMicropubWriting {
  draft: Draft;
  commit: string;
}

export async function createPrivateMicropubWriting(
  slug: string,
  source: string,
  options: PrivateMicropubOptions = {}
): Promise<PrivateMicropubWriting> {
  const store = privateMicropubStore(options);
  if (!store)
    throw new HttpError(503, 'Private draft storage is not configured.');
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

export async function savePrivateWriting(
  writing: StoredWriting,
  source: string,
  privateOptions: PrivateMicropubOptions
): Promise<string> {
  const store = requirePrivateStore(privateOptions);
  const isDraft = Boolean(matter(source).data.draft);
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

function requirePrivateStore(
  options: PrivateMicropubOptions
): PrivateMicropubStore {
  const store = privateMicropubStore(options);
  if (!store)
    throw new HttpError(503, 'Private draft storage is not configured.');
  return store;
}

export async function findPrivateWriting(
  slug: string,
  path: string,
  options: PrivateMicropubOptions
): Promise<StoredWriting | null> {
  const draft = await privateMicropubStore(options)?.bySlug(slug);
  return draft
    ? {
        slug,
        path,
        source: privateSource(draft),
        privateDocumentId: draft.id,
        privateRevisionId: draft.head.id,
        sha: draft.head.body.baseFileSha,
      }
    : null;
}

export async function removePrivateWriting(
  writing: StoredWriting,
  options: PrivateMicropubOptions
): Promise<void> {
  await requirePrivateStore(options).remove(
    writing.privateDocumentId!,
    writing.privateRevisionId!
  );
}
