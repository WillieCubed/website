import { SITE_URL } from '@/lib/indieweb/constants';
import { findActiveToken } from '@/lib/indieweb/indieauth-server';
import { indieAuthStore } from '@/lib/indieweb/indieauth-storage';
import type { IndieAuthVerificationOptions } from '@/lib/indieweb/types';
import { sameOrigin } from '@/lib/indieweb/utils';

export async function micropubTokenStatus({
  bearer,
  expectedMe = SITE_URL,
  requiredScope,
  store = indieAuthStore,
  now = new Date(),
}: IndieAuthVerificationOptions): Promise<
  'valid' | 'invalid' | 'insufficient_scope'
> {
  const record = await findActiveToken(store, bearer, now);
  if (!record || !sameOrigin(record.me, expectedMe)) return 'invalid';
  if (!requiredScope) return 'valid';
  const accepted = Array.isArray(requiredScope)
    ? requiredScope
    : [requiredScope];
  return accepted.some((scope) => record.scope.includes(scope))
    ? 'valid'
    : 'insufficient_scope';
}

/**
 * Check a bearer token that this site's own token endpoint issued. The
 * lookup is local: the token's digest is found in the database, so Micropub
 * never calls out to verify a request.
 */
export async function verifyIndieAuthToken({
  bearer,
  expectedMe = SITE_URL,
  requiredScope,
  store = indieAuthStore,
  now = new Date(),
}: IndieAuthVerificationOptions): Promise<boolean> {
  const record = await findActiveToken(store, bearer, now);
  if (!record || !sameOrigin(record.me, expectedMe)) return false;
  if (!requiredScope) return true;

  const accepted = Array.isArray(requiredScope)
    ? requiredScope
    : [requiredScope];
  return accepted.some((scope) => record.scope.includes(scope));
}

/** The bearer token from an `Authorization` header, or null when absent. */
export function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization?.toLowerCase().startsWith('bearer ')) return null;
  return authorization.slice(7).trim();
}
