import { socialHandlers } from '@/lib/atproto/oauth';

export const maxDuration = 60;

/**
 * Complete the browser-bound OAuth flow, create a session, and apply the
 * requested subscription or recommendation. Redirect back to the writings
 * page or selected writing, adding an error query parameter if authorization
 * or the action fails.
 */
export function GET(request: Request) {
  return socialHandlers().callback(request);
}
