import { SITE_URL } from '@/lib/indieweb/constants';
import { getBearerToken, micropubTokenStatus } from '@/lib/indieweb/indieauth';
import { MediaUploadError, getMediaStore } from '@/lib/indieweb/media';
import {
  MicropubStorageError,
  commitMicropubWriting,
  getMicropubConfig,
  getMicropubSyndicationTargets,
  parseMicropubCreateRequest,
  prepareMicropubPhotoRequest,
  writeMicropubWritingLocally,
} from '@/lib/indieweb/micropub';
import { jsonError, jsonResponse } from '@/lib/indieweb/responses';
import type {
  MicropubCreatedResponse,
  MicropubRouteEnvironment,
} from '@/lib/indieweb/types';

/**
 * Micropub capability discovery.
 *
 * IndieWeb clients call `GET /micropub?q=config` after discovering
 * `<link rel="micropub" href="/micropub" />` in the document head.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (query === 'config') {
    return jsonResponse(getMicropubConfig());
  }

  if (query === 'syndicate-to') {
    return jsonResponse({ 'syndicate-to': getMicropubSyndicationTargets() });
  }

  if (query) {
    return jsonError('invalid_request', 400, `Unsupported query "${query}".`);
  }

  return new Response('OK', { status: 200 });
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

/**
 * Create a writing from an IndieAuth-protected Micropub request.
 *
 * When MICROPUB_GITHUB_REPO and MICROPUB_GITHUB_TOKEN are set the post is
 * committed through GitHub's Contents API so it flows through the same deploy
 * path as a hand-authored writing. Otherwise the file is written into the
 * local content directory, which only works on a writable checkout.
 */
export async function POST(request: Request) {
  const access = await readMicropubAccessToken(request);
  if ('error' in access)
    return jsonError(access.error, access.error === 'unauthorized' ? 401 : 400);

  const environment = getMicropubEnvironment();

  // Tokens come from this site's own token endpoint and are checked locally.
  const tokenStatus = await micropubTokenStatus({
    bearer: access.token,
    expectedMe: SITE_URL,
    requiredScope: 'create',
  }).catch(() => 'unavailable' as const);

  if (tokenStatus === 'invalid') return jsonError('invalid_token', 401);
  if (tokenStatus === 'insufficient_scope')
    return jsonError('insufficient_scope', 403);
  if (tokenStatus === 'unavailable')
    return jsonError('temporarily_unavailable', 503);

  try {
    const prepared = await prepareMicropubPhotoRequest(
      request,
      getMediaStore()
    );
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
  } catch (error) {
    if (error instanceof MediaUploadError) {
      return jsonError(
        error.message === 'Media uploads are not configured.'
          ? 'temporarily_unavailable'
          : 'invalid_request',
        error.message === 'Media uploads are not configured.' ? 503 : 400,
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
    console.error('Micropub create failed:', error);
    return jsonError('server_error', 500);
  }
}

function getMicropubEnvironment(): MicropubRouteEnvironment {
  return {
    githubRepository: process.env.MICROPUB_GITHUB_REPO,
    githubToken: process.env.MICROPUB_GITHUB_TOKEN,
    defaultBranch: process.env.MICROPUB_GITHUB_BRANCH ?? 'main',
    contentPath: process.env.MICROPUB_CONTENT_PATH ?? 'content/writings',
  };
}
