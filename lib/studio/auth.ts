import type { JWTVerifyGetKey } from 'jose';

import { verifyOwnerAccess } from '@/lib/owner/access';

import { isPrivatePreview, privateHeaders, studioOrigin } from './config';
import { StudioError } from './errors';

/** No development bypass: the same signed Access identity gates every origin. */
export async function authorizeStudio(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
  verifyKey?: JWTVerifyGetKey
): Promise<{ email: string }> {
  if (!isPrivatePreview(env)) throw new StudioError(404, 'Not found');
  const issuer = env.OWNER_ACCESS_ISSUER;
  const audience = env.OWNER_ACCESS_AUDIENCE;
  const owner = env.OWNER_ACCESS_EMAIL;
  if (!issuer || !audience || !owner)
    throw new StudioError(503, 'Preview access is not configured.');
  if (!request.headers.get('cf-access-jwt-assertion'))
    throw new StudioError(401, 'Sign in to preview.');
  if (
    !(await verifyOwnerAccess(
      request,
      { issuer, audience, email: owner },
      verifyKey
    ))
  )
    throw new StudioError(403, 'Preview access denied.');
  return { email: owner };
}

export function checkMutationOrigin(
  request: Request,
  origin = studioOrigin()
): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  if (request.headers.get('origin') !== origin)
    throw new StudioError(
      403,
      'This change must come from the preview editor.'
    );
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite))
    throw new StudioError(403, 'Cross-site changes are not allowed.');
}

export async function studioRoute(
  request: Request,
  work: () => Promise<Response>,
  unavailableMessage = 'The private writing service is unavailable.'
): Promise<Response> {
  try {
    await authorizeStudio(request);
    checkMutationOrigin(request);
    const response = await work();
    for (const [key, value] of Object.entries(privateHeaders))
      response.headers.set(key, value);
    return response;
  } catch (error) {
    const known = error instanceof StudioError;
    return Response.json(
      {
        error: known ? error.message : unavailableMessage,
        ...(known && error.details ? { details: error.details } : {}),
      },
      { status: known ? error.status : 503, headers: privateHeaders }
    );
  }
}
