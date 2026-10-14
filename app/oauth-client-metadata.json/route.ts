import { oauthMetadata } from '@/lib/atproto/oauth';

/**
 * Return this site's AT Protocol OAuth client identity, callback URLs,
 * requested permissions, and signing-key URL. Return 503 when sign-in is not
 * configured.
 */
export function GET() {
  return oauthMetadata('metadata');
}
