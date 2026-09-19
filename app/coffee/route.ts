import { coffeeResponse } from '@/lib/htcpcp';

// A teapot refuses coffee however it is asked. HEAD is answered from GET.
export function GET(request: Request) {
  return coffeeResponse(request);
}

export function POST(request: Request) {
  return coffeeResponse(request);
}
