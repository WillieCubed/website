import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { sealJson, unsealJson } from '../crypto/sealed-json';
import { required } from './config';
import { StudioError } from './errors';
import { STUDIO_LATTICE_SCOPE } from './lattice-client-metadata';
import { getStudioPool } from './store';

interface OAuthStart {
  url: string;
  cookie: string;
}
interface OAuthFlow {
  state: string;
  verifier: string;
  origin: string;
  expiresAt: number;
  returnTo?: string;
}

interface Grant {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}
function key(encoded = required('STUDIO_TOKEN_ENCRYPTION_KEY')): string {
  const result = Buffer.from(encoded, 'base64');
  if (result.length !== 32)
    throw new StudioError(
      503,
      'Token encryption requires a 32-byte base64 key.'
    );
  return encoded;
}
export function seal(value: unknown, encryptionKey?: string): string {
  return sealJson(value, key(encryptionKey));
}
export function unseal<T>(value: string, encryptionKey?: string): T {
  try {
    return unsealJson<T>(value, key(encryptionKey));
  } catch {
    throw new StudioError(503, 'Reconnect your Lattice account.');
  }
}
export function oauthConfig(origin: string) {
  return {
    issuer: required('STUDIO_LATTICE_ISSUER').replace(/\/$/, ''),
    clientId: required('STUDIO_LATTICE_CLIENT_ID'),
    resource: required('STUDIO_LATTICE_GATEWAY'),
    redirectUri: `${origin}/api/studio/lattice/callback`,
  };
}
export function writingReturnPath(value: string | null | undefined): string {
  return value && /^\/studio\/[a-f0-9-]{36}\?components=1$/i.test(value)
    ? value
    : '/studio';
}
export function beginOAuth(
  origin: string,
  returnTo?: string | null
): OAuthStart {
  const config = oauthConfig(origin),
    state = randomBytes(32).toString('base64url'),
    verifier = randomBytes(32).toString('base64url');
  const url = new URL(`${config.issuer}/oauth/authorize`);
  Object.entries({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    resource: config.resource,
    scope: STUDIO_LATTICE_SCOPE,
    state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  return {
    url: url.href,
    cookie: seal({
      state,
      verifier,
      origin,
      returnTo: writingReturnPath(returnTo),
      expiresAt: Date.now() + 600_000,
    }),
  };
}
async function exchange(
  origin: string,
  fields: Record<string, string>,
  oldRefresh: string | null = null
): Promise<Grant> {
  const config = oauthConfig(origin);
  const response = await fetch(`${config.issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...fields,
      client_id: config.clientId,
      resource: config.resource,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const body = await response.json();
  if (!response.ok || typeof body.access_token !== 'string')
    throw new StudioError(
      502,
      'Lattice authorization failed. Reconnect your account.'
    );
  if (typeof body.expires_in !== 'number' || body.expires_in <= 0)
    throw new StudioError(502, 'Lattice returned an invalid token lifetime.');
  return {
    accessToken: body.access_token,
    refreshToken:
      typeof body.refresh_token === 'string' ? body.refresh_token : oldRefresh,
    expiresAt: Date.now() + body.expires_in * 1000,
  };
}
async function persist(grant: Grant): Promise<void> {
  await getStudioPool().query(
    "INSERT INTO studio_connections (id, credential) VALUES ('lattice', $1) ON CONFLICT (id) DO UPDATE SET credential = EXCLUDED.credential, updated_at=now()",
    [seal(grant)]
  );
}
function flowCookie(request: Request): string | undefined {
  return request.headers
    .get('cookie')
    ?.split(';')
    .map((v) => v.trim())
    .find((v) => v.startsWith('studio_lattice_flow='))
    ?.slice('studio_lattice_flow='.length);
}
export async function completeOAuth(request: Request): Promise<string> {
  const url = new URL(request.url);
  const cookie = flowCookie(request);
  if (
    !cookie ||
    !url.searchParams.get('code') ||
    !url.searchParams.get('state')
  )
    throw new StudioError(400, 'Authorization response is incomplete.');
  let flow: OAuthFlow;
  try {
    flow = unseal(cookie);
  } catch {
    throw new StudioError(400, 'Authorization state is invalid.');
  }
  const supplied = Buffer.from(url.searchParams.get('state')!),
    expected = Buffer.from(flow.state);
  if (
    flow.expiresAt < Date.now() ||
    flow.origin !== url.origin ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new StudioError(
      400,
      'Authorization state expired or does not match.'
    );
  await persist(
    await exchange(url.origin, {
      grant_type: 'authorization_code',
      code: url.searchParams.get('code')!,
      code_verifier: flow.verifier,
      redirect_uri: oauthConfig(url.origin).redirectUri,
    })
  );
  return writingReturnPath(flow.returnTo);
}
export async function accessToken(): Promise<string> {
  // Serialize refresh-token rotation across concurrent generation requests.
  const client = await getStudioPool().connect();
  try {
    await client.query('BEGIN');
    const rows = await client.query(
      "SELECT credential FROM studio_connections WHERE id='lattice' FOR UPDATE"
    );
    if (rows.rows[0] == null)
      throw new StudioError(503, 'Connect your Lattice account first.');
    let grant = unseal<Grant>(rows.rows[0].credential);
    if (grant.expiresAt < Date.now() + 60_000) {
      if (!grant.refreshToken)
        throw new StudioError(503, 'Reconnect your Lattice account.');
      grant = await exchange(
        required('STUDIO_PUBLIC_ORIGIN'),
        { grant_type: 'refresh_token', refresh_token: grant.refreshToken },
        grant.refreshToken
      );
      await client.query(
        "UPDATE studio_connections SET credential=$1,updated_at=now() WHERE id='lattice'",
        [seal(grant)]
      );
    }
    await client.query('COMMIT');
    return grant.accessToken;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
