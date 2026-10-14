import { teaResponse } from '@/lib/protocols/htcpcp';

/**
 * Return brewing instructions and supported additions as text or HTML
 * according to Accept.
 */
export function GET(request: Request) {
  return teaResponse(request);
}

/**
 * Handle a message/teapot start or stop command. For start, validate
 * requested Accept-Additions and return the brewing result. Return 415 for
 * another content type, 400 for an unknown command, or 406 for unavailable
 * additions.
 */
export function POST(request: Request) {
  return teaResponse(request);
}
