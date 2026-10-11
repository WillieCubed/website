import { type JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from 'jose';

import { isPrivatePreview, privateHeaders, studioOrigin } from './config';
import { StudioError } from './errors';

const keys = new Map<string, JWTVerifyGetKey>();

/** No development bypass: the same signed Access identity gates every origin. */
export async function authorizeStudio(
  request: Request,
  env: NodeJS.ProcessEnv = process.env,
  verifyKey?: JWTVerifyGetKey
): Promise<{ email: string }> {
  if (!isPrivatePreview(env)) throw new StudioError(404, 'Not found');
  const issuer = env.STUDIO_ACCESS_ISSUER;
  const audience = env.STUDIO_ACCESS_AUDIENCE;
  const owner = env.STUDIO_OWNER_EMAIL?.toLowerCase();
  if (!issuer || !audience || !owner)
    throw new StudioError(503, 'Preview access is not configured.');
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) throw new StudioError(401, 'Sign in to preview.');
  if (!verifyKey) {
    if (!keys.has(issuer))
      keys.set(
        issuer,
        createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer))
      );
    verifyKey = keys.get(issuer)!;
  }
  try {
    const { payload } = await jwtVerify(token, verifyKey, {
      issuer,
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat'],
    });
    if (
      typeof payload.email !== 'string' ||
      payload.email.toLowerCase() !== owner
    )
      throw new Error('owner');
    return { email: payload.email };
  } catch {
    throw new StudioError(403, 'Preview access denied.');
  }
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
  work: () => Promise<Response>
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
        error: known
          ? error.message
          : 'The private writing service is unavailable.',
        ...(known && error.details ? { details: error.details } : {}),
      },
      { status: known ? error.status : 503, headers: privateHeaders }
    );
  }
}
