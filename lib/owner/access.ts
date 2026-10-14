import { type JWTVerifyGetKey, createRemoteJWKSet, jwtVerify } from 'jose';

import type { OwnerAuthenticator } from '@/lib/indieweb/indieauth/types';

export interface OwnerAccessConfig {
  issuer: string;
  audience: string;
  email: string;
}

const keys = new Map<string, JWTVerifyGetKey>();

export function ownerAccessFromEnvironment(
  env: Record<string, string | undefined>
): OwnerAccessConfig | null {
  const issuer = env.OWNER_ACCESS_ISSUER;
  const audience = env.OWNER_ACCESS_AUDIENCE;
  const email = env.OWNER_ACCESS_EMAIL;
  if (!issuer || !audience || !email) return null;
  try {
    const url = new URL(issuer);
    if (url.protocol !== 'https:' || url.pathname !== '/') return null;
  } catch {
    return null;
  }
  return { issuer, audience, email };
}

/** Verify the signed identity at the origin, including on direct Worker URLs. */
export async function verifyOwnerAccess(
  request: Request,
  config: OwnerAccessConfig,
  verifyKey?: JWTVerifyGetKey
): Promise<boolean> {
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) return false;
  try {
    if (!verifyKey) {
      let key = keys.get(config.issuer);
      if (!key) {
        key = createRemoteJWKSet(
          new URL('/cdn-cgi/access/certs', config.issuer)
        );
        keys.set(config.issuer, key);
      }
      verifyKey = key;
    }
    const { payload } = await jwtVerify(token, verifyKey, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat'],
    });
    return (
      typeof payload.email === 'string' &&
      payload.email.toLowerCase() === config.email.toLowerCase()
    );
  } catch {
    return false;
  }
}

export function ownerAccessAuthenticatorFromEnvironment(
  env: Record<string, string | undefined>
): OwnerAuthenticator | null {
  const config = ownerAccessFromEnvironment(env);
  if (!config) return null;
  return {
    async verify(request) {
      return (await verifyOwnerAccess(request, config))
        ? { ok: true }
        : { ok: false, reason: 'invalid' };
    },
  };
}
