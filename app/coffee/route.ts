import { coffeeResponse } from '@/lib/protocols/htcpcp';

/**
 * Return HTTP 418 with the teapot explanation as text or HTML according to
 * Accept. HEAD uses the same status and headers.
 */
export function GET(request: Request) {
  return coffeeResponse(request);
}

/** Refuse a coffee-brewing request with HTTP 418 and the teapot explanation. */
export function POST(request: Request) {
  return coffeeResponse(request);
}
