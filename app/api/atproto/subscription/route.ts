import { socialHandlers } from '@/lib/atproto/oauth';

export const maxDuration = 60;

/**
 * Subscribe the signed-in AT Protocol account to this publication and return
 * the active state. Require a same-origin request.
 */
export function PUT(request: Request) {
  return socialHandlers().subscription(request);
}

/**
 * Remove the signed-in account's matching subscriptions to this publication
 * and return active: false. Require a same-origin request.
 */
export const DELETE = PUT;
