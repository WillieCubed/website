import { publishNotification } from '@/lib/indieweb/notify';

// The production project uses the 60-second Hobby limit.
export const maxDuration = 60;

export function POST(request: Request) {
  return publishNotification(request);
}
