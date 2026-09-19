import { whoamiResponse } from '@/lib/whoami';

export function GET(request: Request) {
  return whoamiResponse(request);
}
