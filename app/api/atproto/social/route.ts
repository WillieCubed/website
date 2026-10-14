import { socialHandlers } from '@/lib/atproto/oauth';

export const maxDuration = 60;

/**
 * Return sign-in availability, browser session state, and the account's
 * subscription state. Include recommendation state when a writing slug is
 * supplied. Report ready: false when the publication or document is not
 * verified.
 */
export function GET(request: Request) {
  return socialHandlers().status(request);
}
