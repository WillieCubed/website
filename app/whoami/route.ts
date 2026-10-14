import { whoamiResponse } from '@/lib/protocols/whoami';

/**
 * Return the request's IP address, user agent, and host-provided location
 * and network details as text or HTML according to Accept. Omit unavailable
 * details and do not store the request.
 */
export function GET(request: Request) {
  return whoamiResponse(request);
}
