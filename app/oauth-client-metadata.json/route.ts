import { oauthMetadata } from '@/lib/atproto/oauth';

export function GET() {
  return oauthMetadata('metadata');
}
