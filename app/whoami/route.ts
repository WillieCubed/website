import { getCloudflareContext } from '@opennextjs/cloudflare';

import { whoamiResponse } from '@/lib/protocols/whoami';

/**
 * Return the request's IP address, user agent, and host-provided location
 * and network details as text or HTML according to Accept. Omit unavailable
 * details and do not store the request.
 */
export function GET(request: Request) {
  let cf: Record<string, unknown> | undefined;
  try {
    cf = getCloudflareContext().cf;
  } catch {
    // Local Next.js requests do not carry Cloudflare request metadata.
  }
  return whoamiResponse(request, cf);
}
