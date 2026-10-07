import { socialHandlers } from '@/lib/atproto/oauth';

export const maxDuration = 60;

export function GET(request: Request) {
  return socialHandlers().status(request);
}
