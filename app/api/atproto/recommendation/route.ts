import { socialHandlers } from '@/lib/atproto/oauth';

export const maxDuration = 60;

/**
 * Create a recommendation for the writing identified by the body slug and
 * return its active state. Require a signed-in AT Protocol session and same-
 * origin request.
 */
export function PUT(request: Request) {
  return socialHandlers().recommendation(request);
}

/**
 * Remove the signed-in account's matching recommendations for the body slug
 * and return active: false. Require a same-origin request.
 */
export const DELETE = PUT;
