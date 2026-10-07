import { socialHandlers } from '@/lib/atproto/oauth';

export const maxDuration = 60;

export function PUT(request: Request) {
  return socialHandlers().subscription(request);
}

export const DELETE = PUT;
