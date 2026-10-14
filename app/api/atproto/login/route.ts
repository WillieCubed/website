import { socialHandlers } from '@/lib/atproto/oauth';

export const maxDuration = 60;

/**
 * Start OAuth sign-in for a subscription or writing recommendation. Accept a
 * handle or DID, action, and recommendation slug when needed. Return the
 * provider URL for JSON requests or redirect form submissions; bind the flow
 * to this browser with a cookie. Require a same-origin request.
 */
export function POST(request: Request) {
  return socialHandlers().login(request);
}
