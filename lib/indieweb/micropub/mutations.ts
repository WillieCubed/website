import matter from 'gray-matter';

import { HttpError } from '@/lib/http/errors';
import { jsonResponse, noStoreJsonHeaders } from '@/lib/indieweb/responses';
import { absoluteRoute } from '@/lib/site/urls';

import { authorize } from './access';
import type { MicropubAction } from './actions';
import { micropubArchiveStore, micropubMutationKey } from './archive';
import {
  commitMicropubWriting,
  micropubWritingPath,
  writeMicropubWritingLocally,
} from './create';
import { applyMicropubUpdate } from './document';
import type { MicropubUpdate } from './document-types';
import { type MicropubEndpointOptions, micropubEnvironment } from './options';
import { parseMicropubCreateRequest } from './parse';
import { postNotFound } from './responses';
import { buildMicropubWritingFile } from './serialize';
import { MicropubConflictError } from './storage-types';
import {
  deleteStoredWriting,
  findStoredWriting,
  restoreStoredWriting,
  saveStoredWriting,
  writingSlugForUrl,
} from './store';
import {
  createPrivateMicropubWriting,
  privateMicropubStore,
} from './studio-adapter';
import type {
  MicropubCreatedResponse,
  MicropubRouteEnvironment,
} from './types';

export async function createWriting(
  request: Request,
  options: MicropubEndpointOptions
): Promise<Response> {
  const environment = options.environment ?? micropubEnvironment();
  const entry = await parseMicropubCreateRequest(request.clone());
  if (entry.postStatus !== 'draft') {
    const denied = await authorize(request, 'create', options);
    if (denied) return denied;
  }
  entry.slug = micropubWritingPath(entry, environment.contentPath).slug;
  const permalink = absoluteRoute`/writings/${entry.slug}`;
  if (entry.postStatus === 'draft') {
    const { slug, path } = micropubWritingPath(entry, environment.contentPath);
    const { draft, commit } = await createPrivateMicropubWriting(
      slug,
      buildMicropubWritingFile(entry, slug),
      options
    );
    return jsonResponse(
      {
        status: 'accepted',
        location: permalink,
        slug,
        path,
        commit,
        revision: draft.head.id,
      },
      { status: 202, headers: { ...noStoreJsonHeaders(), Location: permalink } }
    );
  }
  const archives = options.archives ?? micropubArchiveStore;
  return archives.runExclusive(
    micropubMutationKey(environment, permalink),
    async () => {
      if (await findStoredWriting(permalink, environment, options.fetch))
        throw new MicropubConflictError('A post already uses this permalink.');
      const result =
        environment.githubRepository && environment.githubToken
          ? await commitMicropubWriting(
              entry,
              {
                repository: environment.githubRepository,
                token: environment.githubToken,
                branch: environment.defaultBranch,
                contentPath: environment.contentPath,
              },
              options.fetch
            )
          : await writeMicropubWritingLocally(entry, environment.contentPath);
      const body: MicropubCreatedResponse = {
        status: 'accepted',
        location: result.location,
        slug: result.slug,
        path: result.path,
        commit: result.sha,
      };

      return jsonResponse(body, {
        status: 202,
        headers: { Location: result.location },
      });
    }
  );
}

/**
 * The spec allows 200, 201, or 204. This answers 200 with the commit, which
 * is empty when the update changed nothing and no commit was made. The URL
 * never changes, so there is no 201.
 */
async function update(
  url: string,
  changes: MicropubUpdate,
  options: MicropubEndpointOptions
): Promise<Response> {
  const environment = options.environment ?? micropubEnvironment();
  const stored = await findStoredWriting(
    url,
    environment,
    options.fetch,
    options
  );
  if (!stored) return postNotFound();

  const now = (options.now ?? (() => new Date()))();
  const source = applyMicropubUpdate(stored.source, changes, now);
  const commit =
    source === stored.source
      ? ''
      : await saveStoredWriting(
          stored,
          source,
          `chore(content): Update ${stored.slug} via Micropub`,
          environment,
          options.fetch,
          options
        );

  return jsonResponse({
    url: absoluteRoute`/writings/${stored.slug}`,
    path: stored.path,
    commit,
  });
}

/**
 * Archive public source before removing it; private drafts keep immutable studio revisions.
 */
async function remove(
  url: string,
  options: MicropubEndpointOptions
): Promise<Response> {
  const environment = options.environment ?? micropubEnvironment();
  const stored = await findStoredWriting(
    url,
    environment,
    options.fetch,
    options
  );
  if (!stored) return postNotFound();

  if (stored.privateDocumentId) {
    const commit = await deleteStoredWriting(
      stored,
      `chore(content): Delete ${stored.slug} via Micropub`,
      environment,
      options.fetch,
      options
    );
    return jsonResponse({
      url: absoluteRoute`/writings/${stored.slug}`,
      path: stored.path,
      commit,
    });
  }
  // Legacy drafts must be imported before any public archive mutation.
  if (matter(stored.source).data.draft)
    throw new HttpError(
      503,
      'Import this draft into private storage before deleting it.'
    );
  const archives = options.archives ?? micropubArchiveStore;
  const key = micropubMutationKey(environment, url);
  await archives.save(key, url, stored);
  const commit = await deleteStoredWriting(
    stored,
    `chore(content): Delete ${stored.slug} via Micropub`,
    environment,
    options.fetch,
    options
  );
  await archives.mark(key, 'deleted');
  return jsonResponse({
    url: absoluteRoute`/writings/${stored.slug}`,
    path: stored.path,
    commit,
  });
}

async function restore(
  url: string,
  options: MicropubEndpointOptions
): Promise<Response> {
  const environment = options.environment ?? micropubEnvironment();
  const archives = options.archives ?? micropubArchiveStore;
  const key = micropubMutationKey(environment, url);
  const archived = await archives.find(key);
  if (!archived) return postNotFound();
  if (await findStoredWriting(url, environment, options.fetch, options))
    throw new MicropubConflictError(
      'Another post already occupies this permalink.'
    );
  const commit = await restoreStoredWriting(
    archived,
    environment,
    options.fetch
  );
  await archives.mark(key, 'restored');
  return jsonResponse({ url: archived.url, path: archived.path, commit });
}

type MutationAction = Exclude<MicropubAction, { action: 'create' }>;
async function isPrivateMutation(
  action: MutationAction,
  permalink: string,
  environment: MicropubRouteEnvironment,
  options: MicropubEndpointOptions
): Promise<boolean> {
  // Studio revisions use transactional compare-and-swap, keeping private source out of public archives.
  if (
    !privateMicropubStore(options) ||
    !['update', 'delete'].includes(action.action)
  )
    return false;
  const stored = await findStoredWriting(
    permalink,
    environment,
    options.fetch,
    options
  );
  return Boolean(stored?.privateDocumentId);
}
function dispatchMutation(
  action: MutationAction,
  permalink: string,
  options: MicropubEndpointOptions
): Promise<Response> {
  if (action.action === 'update')
    return update(permalink, action.update, options);
  if (action.action === 'undelete') return restore(permalink, options);
  return remove(permalink, options);
}

export async function mutateWriting(
  action: MutationAction,
  options: MicropubEndpointOptions
): Promise<Response> {
  const slug = writingSlugForUrl(action.url);
  if (!slug) return postNotFound();
  const permalink = absoluteRoute`/writings/${slug}`;
  const environment = options.environment ?? micropubEnvironment();
  if (await isPrivateMutation(action, permalink, environment, options)) {
    return dispatchMutation(action, permalink, options);
  }
  const archives = options.archives ?? micropubArchiveStore;
  return await archives.runExclusive(
    micropubMutationKey(environment, permalink),
    () => dispatchMutation(action, permalink, options)
  );
}
