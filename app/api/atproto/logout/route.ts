import { socialHandlers } from '@/lib/atproto/oauth';

export const maxDuration = 60;

/**
 * Delete the current browser's AT Protocol session and clear its session
 * cookie. Return signedIn: false. Require a same-origin request.
 */
export function POST(request: Request) {
  return socialHandlers().logout(request);
}
