import { site } from '@/lib/site/identity';

import { studioOrigin } from './config';

export const LATTICE_CLIENT_METADATA_PATH = '/.well-known/lattice-client.json';
export const STUDIO_LATTICE_SCOPE =
  'openid offline_access lattice:compute:inference';

/** Public OAuth identity only. Credentials and runtime preferences stay private. */
export function latticeClientMetadata() {
  const publicOrigin = new URL(site.origin);
  const previewOrigin = new URL(studioOrigin());
  if (publicOrigin.protocol !== 'https:' || previewOrigin.protocol !== 'https:')
    throw new Error('The public OAuth client requires HTTPS origins.');
  return {
    client_id: new URL(LATTICE_CLIENT_METADATA_PATH, publicOrigin).href,
    client_name: 'Willie Writing Studio',
    client_uri: publicOrigin.origin,
    redirect_uris: [
      new URL('/api/studio/lattice/callback', previewOrigin).href,
    ],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: STUDIO_LATTICE_SCOPE,
    resource: [
      process.env.STUDIO_LATTICE_GATEWAY || 'https://lattice.uselovelace.com',
    ],
  };
}
