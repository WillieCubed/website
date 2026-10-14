import { publishNotification } from '@/lib/indieweb/notify';

export const maxDuration = 60;

/**
 * Notify WebSub subscribers, send changed webmentions, and synchronize AT
 * Protocol records after deployment. Require the notification bearer secret
 * and a body sha matching the deployed commit. Return 409 for a revision
 * mismatch and 502 when required delivery or synchronization fails.
 */
export function POST(request: Request) {
  return publishNotification(request);
}
