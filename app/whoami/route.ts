import { getCloudflareContext } from '@opennextjs/cloudflare';

import { whoamiResponse } from '@/lib/whoami';

export function GET(request: Request) {
  let cf: Record<string, unknown> | undefined;
  try {
    cf = getCloudflareContext().cf;
  } catch {
    // Local Next.js requests do not carry Cloudflare request metadata.
  }
  return whoamiResponse(request, cf);
}
