import { SITE_URL } from '@/lib/indieweb/constants';
import {
  getBearerToken,
  micropubTokenStatus,
} from '@/lib/indieweb/indieauth/verify';
import { jsonError } from '@/lib/indieweb/responses';

import type { MicropubEndpointOptions } from './options';

export type MicropubAccessTokenResult =
  | { token: string }
  | { error: 'unauthorized' | 'invalid_request' };

export async function readMicropubAccessToken(
  request: Request
): Promise<MicropubAccessTokenResult> {
  const headerToken = getBearerToken(request);
  const queryToken = new URL(request.url).searchParams.getAll('access_token');
  let bodyTokens: FormDataEntryValue[], jsonToken: boolean;
  try {
    ({ bodyTokens, jsonToken } = await readBodyCredentials(request));
  } catch {
    return { error: 'invalid_request' };
  }
  if (
    queryToken.length > 0 ||
    jsonToken ||
    bodyTokens.length > 1 ||
    (headerToken && bodyTokens.length > 0)
  )
    return { error: 'invalid_request' };
  const token =
    headerToken ?? (typeof bodyTokens[0] === 'string' ? bodyTokens[0] : null);
  return token ? { token } : { error: 'unauthorized' };
}

/** A response refusing the request, or null when its token may proceed. */
export async function authorize(
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

export function authorizationError(
  error: string,
  status: number,
  scope?: string | string[]
): Response {
  const response = jsonError(error, status);
  const challenge =
    error === 'unauthorized'
      ? 'Bearer'
      : `Bearer error="${error}"${scope !== undefined && scope !== '' ? `, scope="${Array.isArray(scope) ? scope.join(' ') : scope}"` : ''}`;
  response.headers.set('WWW-Authenticate', challenge);
  return response;
}

async function readBodyCredentials(request: Request) {
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
      throw new Error('invalid_request');
    }
  } else if (contentType.includes('application/json')) {
    try {
      const body = await request.clone().json();
      jsonToken = Boolean(
        body && typeof body === 'object' && 'access_token' in body
      );
    } catch {
      throw new Error('invalid_request');
    }
  }
  return { bodyTokens, jsonToken };
}
