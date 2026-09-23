import { INDIEAUTH_TOKEN_ENDPOINT, SITE_URL } from '@/lib/indieweb/constants';
import type {
  IndieAuthTokenResponse,
  IndieAuthVerificationOptions,
} from '@/lib/indieweb/types';
import { sameOrigin } from '@/lib/indieweb/utils';

export async function verifyIndieAuthToken({
  bearer,
  endpoint = INDIEAUTH_TOKEN_ENDPOINT,
  expectedMe = SITE_URL,
  requiredScope,
}: IndieAuthVerificationOptions): Promise<boolean> {
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
  });

  if (!response.ok) return false;

  const data = (await response
    .json()
    .catch(() => null)) as IndieAuthTokenResponse | null;

  if (!data?.me || !sameOrigin(data.me, expectedMe)) return false;
  if (!requiredScope) return true;

  const granted = (data.scope ?? '').split(/\s+/);
  const accepted = Array.isArray(requiredScope)
    ? requiredScope
    : [requiredScope];
  return accepted.some((scope) => granted.includes(scope));
}

/** The bearer token from an `Authorization` header, or null when absent. */
export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) return null;
  return authorization.slice(7).trim();
}
