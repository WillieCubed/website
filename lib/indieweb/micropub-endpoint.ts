import { SITE_URL } from '@/lib/indieweb/constants';
import { getBearerToken, micropubTokenStatus } from '@/lib/indieweb/indieauth';
import {
  MicropubValidationError,
  commitMicropubWriting,
  getMicropubConfig,
  getMicropubSyndicationTargets,
  micropubWritingPath,
  parseMicropubCreateRequest,
  writeMicropubWritingLocally,
} from '@/lib/indieweb/micropub';
import {
  type MicropubAction,
  readMicropubAction,
} from '@/lib/indieweb/micropub-actions';
import {
  type MicropubArchiveStore,
  micropubArchiveStore,
  micropubMutationKey,
} from '@/lib/indieweb/micropub-archive';
import {
  MicropubRequestError,
  type MicropubUpdate,
  applyMicropubUpdate,
  micropubSource,
} from '@/lib/indieweb/micropub-document';
import {
  MicropubConflictError,
  MicropubStorageError,
  deleteStoredWriting,
  findStoredWriting,
  restoreStoredWriting,
  saveStoredWriting,
  writingSlugForUrl,
} from '@/lib/indieweb/micropub-store';
import {
  jsonError,
  jsonResponse,
  noStoreJsonHeaders,
} from '@/lib/indieweb/responses';
import type {
  IndieAuthStore,
  MicropubCreatedResponse,
  MicropubRouteEnvironment,
} from '@/lib/indieweb/types';
import { absoluteRoute } from '@/lib/site';
import { getAllWritings } from '@/lib/writings';
import { groupByTag, normalizeTag } from '@/lib/writings/tags';

/** What the handlers use, each replaceable in tests. */
export interface MicropubEndpointOptions {
  /** Where issued tokens live; the Postgres store by default. */
  store?: IndieAuthStore;
  environment?: MicropubRouteEnvironment;
  archives?: MicropubArchiveStore;
  /** Used for GitHub's Contents API. */
  fetch?: typeof fetch;
  /** Tags of the published writings, for q=category. */
  publishedTags?: () => Promise<string[]>;
  /** The request time an update records as `lastUpdated`. */
  now?: () => Date;
}

export function micropubEnvironment(
  env: NodeJS.ProcessEnv = process.env
): MicropubRouteEnvironment {
  return {
    githubRepository: env.MICROPUB_GITHUB_REPO,
    githubToken: env.MICROPUB_GITHUB_TOKEN,
    defaultBranch: env.MICROPUB_GITHUB_BRANCH ?? 'main',
    contentPath: env.MICROPUB_CONTENT_PATH ?? 'content/writings',
  };
}

/**
 * Micropub queries. `config`, `syndicate-to`, and `category` describe the
 * site and are public. `source` returns a post's own properties, drafts
 * included, so it needs a token for this site, with any scope.
 */
async function micropubGet(
  request: Request,
  options: MicropubEndpointOptions = {}
): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (query === 'config') {
    return jsonResponse(getMicropubConfig());
  }

  if (query === 'syndicate-to') {
    return jsonResponse({ 'syndicate-to': getMicropubSyndicationTargets() });
  }

  if (query === 'category') {
    const tags = await (options.publishedTags ?? publishedTags)();
    const filter = normalizeTag(url.searchParams.get('filter') ?? '');
    return jsonResponse({
      categories: tags.filter((tag) => tag.startsWith(filter)),
    });
  }

  if (query === 'source') {
    const denied = await authorize(request, undefined, options);
    if (denied) return denied;
    return source(url, options);
  }

  if (query) {
    return jsonError('invalid_request', 400, `Unsupported query "${query}".`);
  }

  return new Response('OK', { status: 200 });
}

/**
 * Create, update, or delete a writing. Each needs the scope of the same
 * name.
 *
 * When MICROPUB_GITHUB_REPO and MICROPUB_GITHUB_TOKEN are set every change
 * is committed through GitHub's Contents API so it flows through the same
 * deploy path as a hand-authored writing. Otherwise the file is written into
 * the local content directory, which only works on a writable checkout.
 */
async function micropubPost(
  request: Request,
  options: MicropubEndpointOptions = {}
): Promise<Response> {
  // A malformed body is reported after the token is checked, so a client
  // with a bad token hears about the token first.
  let action: MicropubAction | undefined;
  let actionError: unknown;
  try {
    action = await readMicropubAction(request);
  } catch (error) {
    actionError = error;
  }

  const denied = await authorize(
    request,
    action?.action === 'create' ? ['create', 'draft'] : action?.action,
    options
  );
  if (denied) return denied;
  if (!action) return errorResponse(actionError);

  try {
    if (action.action === 'create') return await create(request, options);
    const slug = writingSlugForUrl(action.url);
    if (!slug) return postNotFound();
    const permalink = absoluteRoute`/writings/${slug}`;
    const environment = options.environment ?? micropubEnvironment();
    const archives = options.archives ?? micropubArchiveStore;
    return await archives.runExclusive(
      micropubMutationKey(environment, permalink),
      async () => {
        if (action.action === 'update')
          return update(permalink, action.update, options);
        if (action.action === 'undelete') return restore(permalink, options);
        return remove(permalink, options);
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readMicropubAccessToken(
  request: Request
): Promise<{ token: string } | { error: 'unauthorized' | 'invalid_request' }> {
  const headerToken = getBearerToken(request);
  const queryToken = new URL(request.url).searchParams.getAll('access_token');
  const contentType = request.headers.get('content-type') ?? '';
  let bodyTokens: FormDataEntryValue[] = [];
  let jsonToken = false;
  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    try {
      bodyTokens = (await request.clone().formData()).getAll('access_token');
    } catch {
      return { error: 'invalid_request' };
    }
  } else if (contentType.includes('application/json')) {
    try {
      const body = await request.clone().json();
      jsonToken = Boolean(
        body && typeof body === 'object' && 'access_token' in body
      );
    } catch {
      return { error: 'invalid_request' };
    }
  }
  if (
    queryToken.length ||
    jsonToken ||
    bodyTokens.length > 1 ||
    (headerToken && bodyTokens.length)
  )
    return { error: 'invalid_request' };
  const token =
    headerToken ?? (typeof bodyTokens[0] === 'string' ? bodyTokens[0] : null);
  return token ? { token } : { error: 'unauthorized' };
}

/** A response refusing the request, or null when its token may proceed. */
async function authorize(
  request: Request,
  requiredScope: string | string[] | undefined,
  options: MicropubEndpointOptions
): Promise<Response | null> {
  const access = await readMicropubAccessToken(request);
  if ('error' in access)
    return authorizationError(
      access.error,
      access.error === 'unauthorized' ? 401 : 400
    );

  // Tokens come from this site's own token endpoint and are checked locally.
  const status = await micropubTokenStatus({
    bearer: access.token,
    expectedMe: SITE_URL,
    requiredScope,
    store: options.store,
  }).catch(() => 'unavailable' as const);

  if (status === 'invalid') return authorizationError('invalid_token', 401);
  if (status === 'insufficient_scope')
    return authorizationError('insufficient_scope', 403, requiredScope);
  if (status === 'unavailable')
    return jsonError('temporarily_unavailable', 503);
  return null;
}

// The query needs no token, so it lists only tags a production visitor can
// already see, even on a server that shows drafts.
async function publishedTags(): Promise<string[]> {
  return groupByTag(await getAllWritings(false)).map(({ tag }) => tag);
}

async function source(
  url: URL,
  options: MicropubEndpointOptions
): Promise<Response> {
  const target = url.searchParams.get('url');
  if (!target) {
    return jsonError('invalid_request', 400, 'q=source needs a url.');
  }
  try {
    const stored = await findStoredWriting(
      target,
      options.environment ?? micropubEnvironment(),
      options.fetch
    );
    if (!stored) return postNotFound();
    return jsonResponse(
      micropubSource(stored.source, absoluteRoute`/writings/${stored.slug}`, [
        ...url.searchParams.getAll('properties[]'),
        ...url.searchParams.getAll('properties'),
      ]),
      { headers: noStoreJsonHeaders() }
    );
  } catch (error) {
    return errorResponse(error);
  }
}

async function create(
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
  const stored = await findStoredWriting(url, environment, options.fetch);
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
          options.fetch
        );

  return jsonResponse({
    url: absoluteRoute`/writings/${stored.slug}`,
    path: stored.path,
    commit,
  });
}

/**
 * Commit a private archive before removing the public source file.
 */
async function remove(
  url: string,
  options: MicropubEndpointOptions
): Promise<Response> {
  const environment = options.environment ?? micropubEnvironment();
  const stored = await findStoredWriting(url, environment, options.fetch);
  if (!stored) return postNotFound();

  const archives = options.archives ?? micropubArchiveStore;
  const key = micropubMutationKey(environment, url);
  await archives.save(key, url, stored);
  const commit = await deleteStoredWriting(
    stored,
    `chore(content): Delete ${stored.slug} via Micropub`,
    environment,
    options.fetch
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
  if (await findStoredWriting(url, environment, options.fetch))
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

function postNotFound(): Response {
  return jsonError(
    'invalid_request',
    400,
    'The post with the requested URL was not found.'
  );
}

function errorResponse(error: unknown): Response {
  if (error instanceof MicropubValidationError) {
    return jsonError('invalid_request', 400, error.message);
  }
  if (error instanceof MicropubRequestError) {
    return jsonError('invalid_request', 400, error.description);
  }
  if (error instanceof Error && error.message === 'invalid_request') {
    return jsonError('invalid_request', 400);
  }
  if (error instanceof MicropubConflictError)
    return jsonError('conflict', 409, error.message);
  if (error instanceof MicropubStorageError) {
    console.error('Micropub storage failed:', error.message);
    return jsonError('server_error', 500, error.message);
  }
  console.error('Micropub request failed:', error);
  return jsonError('server_error', 500);
}

const MICROPUB_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Expose-Headers': 'Location, WWW-Authenticate',
};

export function micropubCorsPreflight(): Response {
  return new Response(null, { status: 204, headers: MICROPUB_CORS });
}

export function withMicropubCors(response: Response): Response {
  for (const [key, value] of Object.entries(MICROPUB_CORS))
    response.headers.set(key, value);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function handleMicropubGet(
  request: Request,
  options: MicropubEndpointOptions = {}
): Promise<Response> {
  return withMicropubCors(await micropubGet(request, options));
}
export async function handleMicropubPost(
  request: Request,
  options: MicropubEndpointOptions = {}
): Promise<Response> {
  return withMicropubCors(await micropubPost(request, options));
}

export function authorizationError(
  error: string,
  status: number,
  scope?: string | string[]
): Response {
  const response = jsonError(error, status);
  const challenge =
    error === 'unauthorized'
      ? 'Bearer'
      : `Bearer error="${error}"${scope ? `, scope="${Array.isArray(scope) ? scope.join(' ') : scope}"` : ''}`;
  response.headers.set('WWW-Authenticate', challenge);
  return response;
}
