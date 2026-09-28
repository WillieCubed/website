import { SITE_URL } from '@/lib/indieweb/constants';
import { getBearerToken, micropubTokenStatus } from '@/lib/indieweb/indieauth';
import { MediaUploadError, getMediaStore } from '@/lib/indieweb/media';
import {
  commitMicropubWriting,
  getMicropubConfig,
  getMicropubSyndicationTargets,
  parseMicropubCreateRequest,
  prepareMicropubPhotoRequest,
  writeMicropubWritingLocally,
} from '@/lib/indieweb/micropub';
import { micropubSource } from '@/lib/indieweb/micropub-document';
import {
  MicropubStorageError,
  findStoredWriting,
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
  /** Used for GitHub's Contents API. */
  fetch?: typeof fetch;
  /** Tags of the published writings, for q=category. */
  publishedTags?: () => Promise<string[]>;
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
export async function handleMicropubGet(
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
 * Create a writing from an IndieAuth-protected Micropub request.
 *
 * When MICROPUB_GITHUB_REPO and MICROPUB_GITHUB_TOKEN are set the post is
 * committed through GitHub's Contents API so it flows through the same deploy
 * path as a hand-authored writing. Otherwise the file is written into the
 * local content directory, which only works on a writable checkout.
 */
export async function handleMicropubPost(
  request: Request,
  options: MicropubEndpointOptions = {}
): Promise<Response> {
  const denied = await authorize(request, 'create', options);
  if (denied) return denied;

  try {
    return await create(request, options);
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
  requiredScope: string | undefined,
  options: MicropubEndpointOptions
): Promise<Response | null> {
  const access = await readMicropubAccessToken(request);
  if ('error' in access)
    return jsonError(access.error, access.error === 'unauthorized' ? 401 : 400);

  // Tokens come from this site's own token endpoint and are checked locally.
  const status = await micropubTokenStatus({
    bearer: access.token,
    expectedMe: SITE_URL,
    requiredScope,
    store: options.store,
  }).catch(() => 'unavailable' as const);

  if (status === 'invalid') return jsonError('invalid_token', 401);
  if (status === 'insufficient_scope')
    return jsonError('insufficient_scope', 403);
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
  const prepared = await prepareMicropubPhotoRequest(request, getMediaStore());
  const entry = await parseMicropubCreateRequest(prepared);
  const result =
    environment.githubRepository && environment.githubToken
      ? await commitMicropubWriting(entry, {
          repository: environment.githubRepository,
          token: environment.githubToken,
          branch: environment.defaultBranch,
          contentPath: environment.contentPath,
        })
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

function postNotFound(): Response {
  return jsonError(
    'invalid_request',
    400,
    'The post with the requested URL was not found.'
  );
}

function errorResponse(error: unknown): Response {
  if (error instanceof MediaUploadError) {
    const unconfigured = error.message === 'Media uploads are not configured.';
    return jsonError(
      unconfigured ? 'temporarily_unavailable' : 'invalid_request',
      unconfigured ? 503 : 400,
      error.message
    );
  }
  if (error instanceof Error && error.message === 'invalid_request') {
    return jsonError('invalid_request', 400);
  }
  if (error instanceof MicropubStorageError) {
    console.error('Micropub storage failed:', error.message);
    return jsonError('server_error', 500, error.message);
  }
  console.error('Micropub request failed:', error);
  return jsonError('server_error', 500);
}
