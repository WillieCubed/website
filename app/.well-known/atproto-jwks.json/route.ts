import { oauthMetadata } from '@/lib/atproto/oauth';

/**
 * Return the public signing keys used by this site's AT Protocol OAuth
 * client. Return 503 when sign-in is not configured.
 */
export function GET() {
  return oauthMetadata('jwks');
}
