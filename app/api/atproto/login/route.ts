import { socialHandlers } from '@/lib/atproto/oauth';

export const maxDuration = 60;

export function POST(request: Request) {
  return socialHandlers().login(request);
}
