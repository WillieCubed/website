import { INDIEAUTH_TOKEN_ENDPOINT, SITE_URL } from '@/lib/indieweb/constants';
import { verifyIndieAuthToken } from '@/lib/indieweb/indieauth';
import {
  MicropubStorageError,
  commitMicropubWriting,
  getMicropubConfig,
  getMicropubSyndicationTargets,
  parseMicropubCreateRequest,
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

/**
 * Create a writing from an IndieAuth-protected Micropub request.
 *
 * When MICROPUB_GITHUB_REPO and MICROPUB_GITHUB_TOKEN are set the post is
 * committed through GitHub's Contents API so it flows through the same deploy
 * path as a hand-authored writing. Otherwise the file is written into the
 * local content directory, which only works on a writable checkout.
 */
export async function POST(request: Request) {
  const bearer = getBearerToken(request);
  if (!bearer) return jsonError('unauthorized', 401);

  const environment = getMicropubEnvironment();

  const tokenIsValid = await verifyIndieAuthToken({
    bearer,
    endpoint: environment.indieAuthTokenEndpoint,
    expectedMe: SITE_URL,
    requiredScope: 'create',
  }).catch(() => false);

  if (!tokenIsValid) return jsonError('forbidden', 403);

  try {
    const entry = await parseMicropubCreateRequest(request);
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

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) return null;
  return authorization.slice(7).trim();
}

function getMicropubEnvironment(): MicropubRouteEnvironment {
  return {
    githubRepository: process.env.MICROPUB_GITHUB_REPO,
    githubToken: process.env.MICROPUB_GITHUB_TOKEN,
    defaultBranch: process.env.MICROPUB_GITHUB_BRANCH ?? 'main',
    contentPath: process.env.MICROPUB_CONTENT_PATH ?? 'content/writings',
    indieAuthTokenEndpoint:
      process.env.INDIEAUTH_TOKEN_ENDPOINT ?? INDIEAUTH_TOKEN_ENDPOINT,
  };
}
